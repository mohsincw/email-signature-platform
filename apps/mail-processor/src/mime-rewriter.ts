import { simpleParser, type ParsedMail, type AddressObject } from "mailparser";
import nodemailer from "nodemailer";
import { randomUUID } from "crypto";
import type { SenderData } from "./sender-lookup";
import { renderSignaturePngCached } from "./png-cache";
import { logger } from "./logger";

// Content-ID for the embedded signature image. We generate a fresh
// random CID for EVERY outgoing message inside rewriteMessageWithSignature,
// because Outlook (and some other clients) caches CID-referenced images
// globally by CID string — so if every message used the same CID,
// Outlook would keep showing whatever signature it cached first,
// regardless of which sender actually sent the new email. Per-message
// random CIDs sidestep this entirely.
const SIGNATURE_CID_DOMAIN = "chaiiwala.co.uk";

// Unique marker header so Exchange's transport rule exception can skip
// re-processing messages that have already been through us. Must be a
// "X-" header to be considered non-standard and safe.
export const PROCESSED_HEADER = "X-ESP-Processed";
export const PROCESSED_HEADER_VALUE = "v1";

// Display dimensions for the signature image (must match packages/signature-png).
const SIG_WIDTH = 314;
const SIG_HEIGHT = 154;

interface RewriteResult {
  raw: Buffer;
}

/**
 * Take the raw bytes of an incoming SMTP message and produce a
 * modified version with:
 *   1. The original HTML body augmented with <img src="cid:..."> +
 *      disclaimer
 *   2. A new CID-embedded signature PNG attachment
 *   3. The loop-prevention header
 *   4. All original headers preserved as best we can (From, To, CC,
 *      Subject, Date, Message-ID, References, In-Reply-To, Reply-To)
 *   5. All original attachments preserved
 */
export async function rewriteMessageWithSignature(
  rawMessage: Buffer,
  senderData: SenderData
): Promise<RewriteResult> {
  const parsed: ParsedMail = await simpleParser(rawMessage);

  // Render the signature PNG for this sender (cached).
  const { sender, settings } = senderData;
  const signaturePng = await renderSignaturePngCached(sender.email, {
    senderName: sender.name,
    senderTitle: sender.title,
    senderPhone: sender.phone,
    senderPhone2: sender.phone2,
    addressLine1: settings.addressLine1,
    addressLine2: settings.addressLine2,
    website: settings.website,
    logoUrl: settings.logoUrl,
    badgeUrl: settings.badgeUrl,
  });

  // Fresh CID per message — see comment on SIGNATURE_CID_DOMAIN above.
  // Without this, Outlook caches the signature image globally and every
  // subsequent email shows whichever signature was cached first
  // (classic cross-sender contamination bug).
  const signatureCid = `esp-signature-${randomUUID()}@${SIGNATURE_CID_DOMAIN}`;

  // Build the HTML snippet that references the CID image + disclaimer
  // Matches the exact structure CodeTwo uses: plain <img>, single <br>,
  // <i> tag with <span> for the disclaimer.
  const cidImg = `<img src="cid:${signatureCid}" border="0" alt="Chaiiwala signature" width="${SIG_WIDTH}" height="${SIG_HEIGHT}" style="font-family:Arial;width:${SIG_WIDTH}px;height:${SIG_HEIGHT}px;border:0;outline:none;text-decoration:none;" />`;

  const disclaimerHtml = settings.disclaimer
    ? `<br/><i style="font-family:Arial;"><span style="font-size:8.0pt;color:#333333;">${settings.disclaimer}</span></i>`
    : "";

  const signatureHtmlSnippet = `<br/>${cidImg}${disclaimerHtml}`;

  // Augment the HTML body. For forwards and replies the signature must
  // sit at the bottom of the sender's NEW content, not at the bottom of
  // the entire thread (which would be below the quoted original). We
  // look for Outlook's forward/reply boundary markers and insert the
  // signature immediately before them. This matches what CodeTwo and
  // Outlook's own signature placement do.
  let newHtml: string;
  if (parsed.html && typeof parsed.html === "string") {
    newHtml = insertSignatureIntoHtml(parsed.html, signatureHtmlSnippet);
  } else {
    // Plain-text-only messages — synthesise an HTML part with the
    // original text, then the signature. Nodemailer sends both the
    // text and html, giving clients a choice via multipart/alternative.
    const escapedText = (parsed.text ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\n/g, "<br/>");
    newHtml = `<div>${escapedText}</div>${signatureHtmlSnippet}`;
  }

  // Augment the plain text body with a text-mode footer, placed at
  // the bottom of the new content (above the forward/reply header)
  // using the same boundary detection as the HTML path.
  const textFooterLines = ["---", sender.name];
  if (sender.title) textFooterLines.push(sender.title);
  if (sender.phone) textFooterLines.push(sender.phone);
  if (sender.phone2) textFooterLines.push(sender.phone2);
  if (settings.addressLine1) textFooterLines.push(settings.addressLine1);
  if (settings.addressLine2) textFooterLines.push(settings.addressLine2);
  if (settings.website) textFooterLines.push(settings.website);
  if (settings.disclaimer) textFooterLines.push("", settings.disclaimer);
  const newText = insertSignatureIntoText(
    parsed.text ?? "",
    textFooterLines.join("\n")
  );

  // Preserve the original recipients + metadata.
  const from = formatAddressList(parsed.from);
  const to = formatAddressList(parsed.to);
  const cc = formatAddressList(parsed.cc);
  const bcc = formatAddressList(parsed.bcc);
  const replyTo = formatAddressList(parsed.replyTo);

  // Preserve original attachments, separating calendar parts from
  // regular attachments. Calendar invites are `text/calendar` MIME
  // parts that Outlook expects to live inside the multipart/alternative
  // alongside text/plain and text/html. If we dump them into the
  // regular attachments array, nodemailer puts them outside the
  // alternative boundary, which turns them into standalone .ics file
  // attachments and breaks the inline meeting invite rendering.
  const regularAttachments: any[] = [];
  let calendarEvent: { method: string; content: Buffer } | undefined;

  for (const att of parsed.attachments || []) {
    if (
      att.contentType === "text/calendar" ||
      att.contentType === "application/ics"
    ) {
      // Take the first calendar part — that's the inline invite.
      // If there's also an application/ics copy (attachment version),
      // skip it; nodemailer's icalEvent adds one automatically.
      if (!calendarEvent && att.contentType === "text/calendar") {
        // Extract the METHOD from the content type params or from
        // the VCALENDAR body itself. Outlook uses the method to
        // decide whether to show Accept / Decline buttons.
        const methodMatch = att.content
          .toString()
          .match(/METHOD:(\w+)/i);
        calendarEvent = {
          method: methodMatch ? methodMatch[1] : "REQUEST",
          content: att.content,
        };
      }
      // Skip — don't add calendar parts to regular attachments
    } else {
      regularAttachments.push({
        filename: att.filename,
        content: att.content,
        contentType: att.contentType,
        cid: att.cid,
        contentDisposition: (att.contentDisposition as any) || "attachment",
      });
    }
  }

  // Use nodemailer to build the outgoing MIME. We use streamTransport
  // in buffer mode so nothing goes over the wire — we just need the
  // serialised bytes to hand back to our relay step.
  const streamTransport = nodemailer.createTransport({
    streamTransport: true,
    buffer: true,
  });

  const info = await streamTransport.sendMail({
    from,
    to,
    cc,
    bcc,
    replyTo,
    subject: parsed.subject,
    text: newText,
    html: newHtml,
    date: parsed.date ?? new Date(),
    messageId: parsed.messageId,
    references: parsed.references as any,
    inReplyTo: parsed.inReplyTo,
    headers: {
      [PROCESSED_HEADER]: PROCESSED_HEADER_VALUE,
    },
    // Calendar invites go through nodemailer's dedicated icalEvent
    // path so they stay as text/calendar inside multipart/alternative
    // (where Outlook's meeting rendering can see them) rather than
    // being demoted to a regular attachment.
    ...(calendarEvent
      ? {
          icalEvent: {
            method: calendarEvent.method,
            content: calendarEvent.content,
          },
        }
      : {}),
    attachments: [
      ...regularAttachments,
      {
        filename: "signature.png",
        content: signaturePng,
        cid: signatureCid,
        contentType: "image/png",
        contentDisposition: "inline",
      },
    ],
  });

  logger.debug(
    { from, messageId: parsed.messageId },
    "Rewrote MIME with CID signature"
  );

  return { raw: info.message as Buffer };
}

/**
 * Pass-through rebuild for unknown / disabled senders. We parse the
 * incoming MIME, then rebuild it cleanly via nodemailer (same path
 * the signed messages use), which:
 *
 *   1. Drops all of Exchange's accumulated routing / ARC / X-MS-*
 *      headers from the previous hop — critical because otherwise
 *      Exchange treats the return trip as a loop and bounces with
 *      `554 5.4.14 Hop count exceeded`.
 *   2. Embeds the X-ESP-Processed loop-prevention header inside the
 *      proper MIME header block via nodemailer's `headers` option,
 *      which is the form Exchange's transport rule exception
 *      reliably matches. (Prepending it to the raw buffer before
 *      handing to nodemailer's `raw:` mode did NOT work in practice
 *      — Exchange still counted the pre-existing Received: hops.)
 *
 * No signature is injected. The body passes through untouched.
 */
export async function rebuildMessageForRelay(
  rawMessage: Buffer
): Promise<Buffer> {
  const parsed: ParsedMail = await simpleParser(rawMessage);

  const from = formatAddressList(parsed.from);
  const to = formatAddressList(parsed.to);
  const cc = formatAddressList(parsed.cc);
  const bcc = formatAddressList(parsed.bcc);
  const replyTo = formatAddressList(parsed.replyTo);

  const originalAttachments = (parsed.attachments || []).map((att) => ({
    filename: att.filename,
    content: att.content,
    contentType: att.contentType,
    cid: att.cid,
    contentDisposition: (att.contentDisposition as any) || "attachment",
  }));

  const streamTransport = nodemailer.createTransport({
    streamTransport: true,
    buffer: true,
  });

  const info = await streamTransport.sendMail({
    from,
    to,
    cc,
    bcc,
    replyTo,
    subject: parsed.subject,
    text: parsed.text ?? undefined,
    html: typeof parsed.html === "string" ? parsed.html : undefined,
    date: parsed.date ?? new Date(),
    messageId: parsed.messageId,
    references: parsed.references as any,
    inReplyTo: parsed.inReplyTo,
    headers: {
      [PROCESSED_HEADER]: PROCESSED_HEADER_VALUE,
    },
    attachments: originalAttachments,
  });

  logger.debug(
    { from, messageId: parsed.messageId },
    "Rebuilt MIME for pass-through relay (no signature)"
  );

  return info.message as Buffer;
}

/**
 * Insert the signature snippet into an HTML body at the right spot:
 * immediately above the forward/reply quoted content if we can find
 * a well-known boundary marker, otherwise just before </body>, or at
 * the very end if there's no body tag either.
 *
 * Markers checked (earliest match in the document wins):
 *   - <div id="appendonsend">          — Outlook Web / new Outlook
 *   - <div id="divRplyFwdMsg">         — classic Outlook divider
 *   - <hr id="stopSpelling">           — classic Outlook divider
 *   - <div class="OutlookMessageHeader"> — classic Outlook header
 *   - <div style="...border-top:solid ..."> immediately followed by
 *     a "From:" label — classic Outlook Desktop forward/reply header
 *     (the thin grey divider line above the From/Sent/To/Subject
 *     block). This is the marker Outlook Desktop actually produces.
 *   - <div class="gmail_quote">        — Gmail quoted content
 *   - <blockquote type="cite">         — generic webmail quote
 *   - -----Original Message-----       — plain-text forward header
 *   - On <date> wrote:                 — generic reply intro
 */
function insertSignatureIntoHtml(html: string, snippet: string): string {
  const markers: RegExp[] = [
    /<div[^>]*\bid=["']appendonsend["'][^>]*>/i,
    /<div[^>]*\bid=["']divRplyFwdMsg["'][^>]*>/i,
    /<hr[^>]*\bid=["']stopSpelling["'][^>]*>/i,
    /<div[^>]*\bclass=["'][^"']*\bOutlookMessageHeader\b[^"']*["'][^>]*>/i,
    // Outlook Desktop forward/reply divider: a <div> with border-top
    // in its inline style, followed (within ~1000 chars) by a "From:"
    // label. The lookahead on "From:" reduces false positives against
    // unrelated content borders.
    /<div[^>]*\bstyle=["'][^"']*\bborder-top:\s*solid\b[^"']*["'][^>]*>(?=[\s\S]{0,1000}From:)/i,
    /<div[^>]*\bclass=["'][^"']*\bgmail_quote\b[^"']*["'][^>]*>/i,
    /<blockquote[^>]*\btype=["']cite["'][^>]*>/i,
    /-----\s*Original Message\s*-----/i,
    /On\s[^<]{1,120}\swrote:/i,
  ];

  let earliest: number | null = null;
  for (const re of markers) {
    const m = html.match(re);
    if (m && m.index !== undefined) {
      if (earliest === null || m.index < earliest) earliest = m.index;
    }
  }

  if (earliest !== null) {
    return html.slice(0, earliest) + snippet + html.slice(earliest);
  }

  if (html.includes("</body>")) {
    return html.replace("</body>", `${snippet}</body>`);
  }

  return html + snippet;
}

/**
 * Plain-text equivalent: insert the text footer above the first
 * forward/reply header line we can find, so it lands at the bottom of
 * the user's new content instead of at the very bottom of the thread.
 */
function insertSignatureIntoText(text: string, footer: string): string {
  const markers: RegExp[] = [
    // Outlook Desktop plain-text forward/reply header (From: ... \n Sent: ...)
    /\n\s*From:\s.+\n\s*Sent:\s/i,
    // Old-school original message marker
    /\n-+\s*Original Message\s*-+/i,
    // Generic reply intro
    /\nOn\s.{1,120}\swrote:/i,
  ];

  let earliest: number | null = null;
  for (const re of markers) {
    const m = text.match(re);
    if (m && m.index !== undefined) {
      if (earliest === null || m.index < earliest) earliest = m.index;
    }
  }

  if (earliest !== null) {
    return text.slice(0, earliest) + "\n" + footer + "\n" + text.slice(earliest);
  }
  return text + "\n" + footer;
}

function formatAddressList(
  addr: AddressObject | AddressObject[] | undefined
): string | undefined {
  if (!addr) return undefined;
  const list = Array.isArray(addr) ? addr : [addr];
  const out: string[] = [];
  for (const group of list) {
    for (const entry of group.value ?? []) {
      if (!entry.address) continue;
      if (entry.name) {
        out.push(`"${entry.name.replace(/"/g, '\\"')}" <${entry.address}>`);
      } else {
        out.push(entry.address);
      }
    }
  }
  return out.length > 0 ? out.join(", ") : undefined;
}

export async function isAlreadyProcessed(
  rawMessage: Buffer
): Promise<boolean> {
  const parsed = await simpleParser(rawMessage);
  const hdr = parsed.headers.get(PROCESSED_HEADER.toLowerCase());
  return hdr === PROCESSED_HEADER_VALUE;
}

export async function extractSenderEmail(
  rawMessage: Buffer
): Promise<string | null> {
  const parsed = await simpleParser(rawMessage);
  const from = parsed.from;
  if (!from) return null;
  const list = Array.isArray(from) ? from : [from];
  for (const group of list) {
    for (const entry of group.value ?? []) {
      if (entry.address) return entry.address.toLowerCase();
    }
  }
  return null;
}
