import { simpleParser, type ParsedMail, type AddressObject } from "mailparser";
import nodemailer from "nodemailer";
import type { SenderData } from "./sender-lookup";
import { renderSignaturePngCached } from "./png-cache";
import { logger } from "./logger";

// Content-ID for the embedded signature image. The HTML body references
// this via <img src="cid:esp-signature@chaiiwala.co.uk">.
const SIGNATURE_CID = "esp-signature@chaiiwala.co.uk";

// Unique marker header so Exchange's transport rule exception can skip
// re-processing messages that have already been through us. Must be a
// "X-" header to be considered non-standard and safe.
export const PROCESSED_HEADER = "X-ESP-Processed";
export const PROCESSED_HEADER_VALUE = "v1";

// Display dimensions for the signature image (must match packages/signature-png).
const SIG_WIDTH = 540;
const SIG_HEIGHT = 265;

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

  // Build the HTML snippet that references the CID image + disclaimer
  // Matches the exact structure CodeTwo uses: plain <img>, single <br>,
  // <i> tag with <span> for the disclaimer.
  const cidImg = `<img src="cid:${SIGNATURE_CID}" border="0" alt="Chaiiwala signature" width="${SIG_WIDTH}" height="${SIG_HEIGHT}" style="font-family:Arial;width:${SIG_WIDTH}px;height:${SIG_HEIGHT}px;border:0;outline:none;text-decoration:none;" />`;

  const disclaimerHtml = settings.disclaimer
    ? `<br/><i style="font-family:Arial;"><span style="font-size:8.0pt;color:#333333;">${settings.disclaimer}</span></i>`
    : "";

  const signatureHtmlSnippet = `<br/>${cidImg}${disclaimerHtml}`;

  // Augment the HTML body. If the original message was HTML, insert
  // just before </body>; else wrap the text/html we synthesise.
  let newHtml: string;
  if (parsed.html && typeof parsed.html === "string") {
    if (parsed.html.includes("</body>")) {
      newHtml = parsed.html.replace("</body>", `${signatureHtmlSnippet}</body>`);
    } else {
      newHtml = parsed.html + signatureHtmlSnippet;
    }
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

  // Augment the plain text body with a text-mode footer.
  const textFooterLines = ["", "---", sender.name];
  if (sender.title) textFooterLines.push(sender.title);
  if (sender.phone) textFooterLines.push(sender.phone);
  if (sender.phone2) textFooterLines.push(sender.phone2);
  if (settings.addressLine1) textFooterLines.push(settings.addressLine1);
  if (settings.addressLine2) textFooterLines.push(settings.addressLine2);
  if (settings.website) textFooterLines.push(settings.website);
  if (settings.disclaimer) textFooterLines.push("", settings.disclaimer);
  const newText = (parsed.text ?? "") + "\n" + textFooterLines.join("\n");

  // Preserve the original recipients + metadata.
  const from = formatAddressList(parsed.from);
  const to = formatAddressList(parsed.to);
  const cc = formatAddressList(parsed.cc);
  const bcc = formatAddressList(parsed.bcc);
  const replyTo = formatAddressList(parsed.replyTo);

  // Preserve original attachments (that aren't inline content already
  // referenced in the HTML — those get copied through as-is).
  const originalAttachments = (parsed.attachments || []).map((att) => ({
    filename: att.filename,
    content: att.content,
    contentType: att.contentType,
    cid: att.cid,
    contentDisposition: (att.contentDisposition as any) || "attachment",
  }));

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
    attachments: [
      ...originalAttachments,
      {
        filename: "signature.png",
        content: signaturePng,
        cid: SIGNATURE_CID,
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
