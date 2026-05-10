import { Splitter, Joiner, Rewriter } from "mailsplit";
import { Readable } from "stream";
import { randomUUID } from "crypto";

/**
 * Surgical MIME modification for the mail-processor.
 *
 * This module avoids the full parse-and-rebuild trap. The old
 * approach (mailparser → nodemailer round-trip) destroyed TNEF
 * content, turned calendar invites into .ics attachments, doubled
 * the message size on attachment re-encode, and blew past 100,000
 * header objects on pathological 11MB forwarded chains.
 *
 * The new approach modifies only what we need:
 *   - Pass-through: strip any accumulated Received headers (to
 *     avoid hop-count issues on the return trip), add X-ESP-Processed
 *     header, everything else untouched.
 *   - Signed: modify the existing text/html part in place to inject
 *     <img src="cid:...">, wrap the whole original message in a new
 *     multipart/related envelope with the PNG as a sibling part,
 *     and add X-ESP-Processed at the top. The PNG is added as a
 *     single new MIME part. No full rebuild. No re-encoding of
 *     existing attachments. Size inflation is minimal (just the
 *     PNG size + ~200 bytes of MIME headers).
 *
 * Uses mailsplit for the text/html rewrite so content-transfer-
 * encoding (quoted-printable, base64, 7bit, 8bit) is handled
 * transparently and we never need to know it.
 */

export interface SignatureInjectionInput {
  /** Raw SMTP DATA bytes as received from Exchange. */
  rawMessage: Buffer;
  /** Rendered signature PNG buffer. */
  signaturePng: Buffer;
  /** Unique Content-ID for the PNG (no angle brackets). */
  signatureCid: string;
  /** HTML snippet to inject before </body>. Should reference the CID. */
  htmlSnippet: string;
  /** Plain text footer to append to the text body. */
  textFooter: string;
  /** Called with the parsed html content to detect the best insertion point. */
  insertHtml: (html: string, snippet: string) => string;
  /** Called with the parsed plain text body to detect the best insertion point. */
  insertText: (text: string, footer: string) => string;
}

const PROCESSED_HEADER = "X-ESP-Processed";
const PROCESSED_HEADER_VALUE = "v1";

/**
 * Modify the text/html and text/plain parts of a raw MIME message
 * using mailsplit, without touching any other part. Returns the
 * modified raw bytes.
 */
async function rewriteBodyPartsWithMailsplit(
  rawMessage: Buffer,
  insertHtml: (html: string, snippet: string) => string,
  htmlSnippet: string,
  insertText: (text: string, footer: string) => string,
  textFooter: string
): Promise<{ modified: Buffer; hasHtml: boolean; hasText: boolean }> {
  // Accept a text/html or text/plain node at any depth in the tree.
  // We rewrite only the FIRST one we encounter of each so nested
  // forwarded content isn't accidentally rewritten.
  let htmlDone = false;
  let textDone = false;
  const rewriter = new Rewriter((node: any) => {
    if (node.contentType === "text/html" && !htmlDone) {
      htmlDone = true;
      return true;
    }
    if (node.contentType === "text/plain" && !textDone) {
      textDone = true;
      return true;
    }
    return false;
  });

  rewriter.on("node", (data: any) => {
    const chunks: Buffer[] = [];
    data.decoder.on("readable", () => {
      let chunk: Buffer | null;
      while ((chunk = data.decoder.read()) !== null) {
        chunks.push(chunk);
      }
    });
    data.decoder.on("end", () => {
      // Use latin1 (byte-preserving) encoding. Every byte 0x00–0xFF
      // maps 1:1 to a Unicode codepoint and back, so NO bytes are
      // lost or replaced regardless of the original charset. This
      // is critical because many Outlook messages use Windows-1252
      // where smart quotes (0x91–0x94) and dashes (0x96–0x97) are
      // valid single bytes. Decoding those as UTF-8 would replace
      // them with U+FFFD, mangling every apostrophe in the body.
      //
      // Our inserted snippets (CID img tag, disclaimer, text footer)
      // are pure ASCII so they're safe in any charset context. The
      // text footer's address lines might have non-ASCII like "•"
      // which we sanitise to ASCII in the caller via
      // sanitiseForPlainText().
      const original = Buffer.concat(chunks).toString("latin1");
      const modified =
        data.node.contentType === "text/html"
          ? insertHtml(original, htmlSnippet)
          : insertText(original, textFooter);
      data.encoder.end(Buffer.from(modified, "latin1"));
    });
  });

  return new Promise<{ modified: Buffer; hasHtml: boolean; hasText: boolean }>(
    (resolve, reject) => {
      const splitter = new Splitter();
      const joiner = new Joiner();
      const input = Readable.from(rawMessage);
      const outChunks: Buffer[] = [];

      joiner.on("data", (chunk: Buffer) => outChunks.push(chunk));
      joiner.on("end", () =>
        resolve({
          modified: Buffer.concat(outChunks),
          hasHtml: htmlDone,
          hasText: textDone,
        })
      );
      joiner.on("error", reject);
      input.on("error", reject);
      splitter.on("error", reject);
      rewriter.on("error", reject);

      input.pipe(splitter).pipe(rewriter).pipe(joiner);
    }
  );
}

/**
 * Find the index where the message headers end (first blank line).
 * Handles both CRLF and LF line endings.
 */
function findHeadersEnd(raw: Buffer): { end: number; sep: string } {
  const crlf = raw.indexOf("\r\n\r\n");
  if (crlf !== -1) return { end: crlf, sep: "\r\n" };
  const lf = raw.indexOf("\n\n");
  if (lf !== -1) return { end: lf, sep: "\n" };
  // No body — treat the whole thing as headers.
  return { end: raw.length, sep: "\r\n" };
}

/**
 * Split the top-level headers block into individual header lines,
 * handling RFC 5322 line folding (continuation lines start with
 * whitespace).
 */
function parseHeaderLines(headersBlock: string): string[] {
  const lines: string[] = [];
  const raw = headersBlock.split(/\r?\n/);
  let current = "";
  for (const line of raw) {
    if (line.length === 0) {
      if (current) {
        lines.push(current);
        current = "";
      }
      continue;
    }
    if (/^[\t ]/.test(line)) {
      // continuation of previous header
      current += "\r\n" + line;
    } else {
      if (current) lines.push(current);
      current = line;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function getHeaderName(line: string): string {
  const colon = line.indexOf(":");
  return colon === -1 ? "" : line.slice(0, colon).trim().toLowerCase();
}

/**
 * Strip one or more named headers from a header block and return
 * the remaining headers joined back together. Case-insensitive.
 * Folded continuation lines are handled correctly.
 */
function removeHeaders(headersBlock: string, names: string[]): string {
  const target = new Set(names.map((n) => n.toLowerCase()));
  const lines = parseHeaderLines(headersBlock);
  return lines.filter((l) => !target.has(getHeaderName(l))).join("\r\n");
}

/**
 * Extract a single header's full value (including folded continuation)
 * from a header block. Returns null if not present.
 */
function getHeaderValue(headersBlock: string, name: string): string | null {
  const lower = name.toLowerCase();
  const lines = parseHeaderLines(headersBlock);
  for (const line of lines) {
    if (getHeaderName(line) === lower) {
      const colon = line.indexOf(":");
      return line.slice(colon + 1).trim();
    }
  }
  return null;
}

/**
 * Prepend a header line to a raw MIME buffer. Inserts at the top of
 * the header block so we don't need to scan for the end-of-headers
 * marker. Valid SMTP — header order is not significant per RFC 5322.
 */
function prependHeader(raw: Buffer, name: string, value: string): Buffer {
  const line = Buffer.from(`${name}: ${value}\r\n`);
  return Buffer.concat([line, raw]);
}

/**
 * Strip all accumulated routing / hop-counting headers from the
 * top-level header block. Used on pass-through relays so that any
 * prior routing trail doesn't push the message past Exchange's
 * hop-count or loop-detection limits on the return trip. Exchange's
 * inbound connector (CloudServicesMailEnabled + IP trust) will
 * re-create the routing headers from scratch when it accepts the
 * message, so we're safe to blow them all away.
 *
 * Headers stripped:
 *   - Received / X-Received — RFC 5321 routing trail, counted toward
 *     the MTA hop limit.
 *   - ARC-Seal / ARC-Message-Signature / ARC-Authentication-Results
 *     — the ARC authenticated chain of prior hops.
 *   - X-MS-Exchange-Organization-OriginalArrivalTime and
 *     X-MS-Exchange-Organization-Network-Message-Id — Exchange's
 *     internal hop-count / loop-detection identifiers.
 *   - X-MS-Exchange-Transport-*, X-MS-Exchange-CrossTenant-*,
 *     X-Forefront-Antispam-Report, X-Microsoft-Antispam*,
 *     X-MS-TrafficType*, X-MS-PublicTrafficType,
 *     X-MS-Office365-Filtering-Correlation-Id,
 *     X-MS-Exchange-AntiSpam-*, X-Ms-Exchange-SenderADCheck,
 *     Authentication-Results-Original — Exchange's own routing
 *     metadata that it adds on each ingress and can reuse for loop
 *     detection.
 *
 * NOT stripped:
 *   - DKIM-Signature — must survive to keep DKIM valid.
 *   - X-MS-Exchange-Organization-AuthAs / AuthSource — required for
 *     CloudServicesMailEnabled-based trust on re-ingress.
 *   - Message-ID, References, In-Reply-To — threading.
 *   - From / To / Cc / Bcc / Subject / Date — standard metadata.
 */
const STRIP_ROUTING_HEADERS_EXACT = [
  "received",
  "x-received",
  "arc-seal",
  "arc-message-signature",
  "arc-authentication-results",
  "x-ms-exchange-organization-originalarrivaltime",
  "x-ms-exchange-organization-network-message-id",
  "x-ms-exchange-organization-scl",
  "x-ms-exchange-organization-authmechanism",
  "x-ms-exchange-transport-crosstenantheadersstamped",
  "x-ms-exchange-transport-endtoendlatency",
  "x-ms-exchange-transport-rules-loop",
  "x-ms-publictraffictype",
  "x-ms-traffictypediagnostic",
  "x-ms-office365-filtering-correlation-id",
  "x-ms-exchange-atpsafelinks-stat",
  "x-ms-exchange-senderadcheck",
  "x-ms-exchange-antispam-messagedata-chunkcount",
  "x-ms-exchange-antispam-messagedata-0",
  "x-ms-exchange-antispam-messagedata-1",
  "x-ms-exchange-antispam-messagedata",
  "x-ms-exchange-antispam-relay",
  "x-forefront-antispam-report",
  "x-microsoft-antispam",
  "x-microsoft-antispam-mailbox-delivery",
  "x-microsoft-antispam-message-info",
  "authentication-results-original",
];
const STRIP_ROUTING_HEADERS_PREFIX = [
  "x-ms-exchange-crosstenant-",
];

function stripRoutingHeadersFromTop(raw: Buffer): Buffer {
  const { end, sep } = findHeadersEnd(raw);
  const sepLen = sep === "\r\n" ? 4 : 2;
  const headers = raw.slice(0, end).toString("utf-8");
  const body = raw.slice(end + sepLen);

  const target = new Set(STRIP_ROUTING_HEADERS_EXACT);
  const lines = parseHeaderLines(headers);
  const filtered = lines.filter((line) => {
    const name = getHeaderName(line);
    if (target.has(name)) return false;
    for (const prefix of STRIP_ROUTING_HEADERS_PREFIX) {
      if (name.startsWith(prefix)) return false;
    }
    return true;
  });

  return Buffer.concat([
    Buffer.from(filtered.join("\r\n")),
    Buffer.from("\r\n\r\n"),
    body,
  ]);
}

// Back-compat alias for the original name.
function stripReceivedHeadersFromTop(raw: Buffer): Buffer {
  return stripRoutingHeadersFromTop(raw);
}

/**
 * Pass-through prepare: wrap the original message in a new
 * multipart/mixed envelope, strip accumulated routing headers from
 * the new top-level, and stamp X-ESP-Processed. The envelope wrap
 * is what actually unblocks poisoned messages from yesterday's
 * loop — a new top-level Content-Type + random boundary makes
 * Exchange's per-message hop counter treat it as a FRESH message
 * instead of reusing the stuck state it has cached for the
 * original envelope. Same trick used by the signed path, which is
 * why mohsin's 11MB email finally delivered once we moved it to
 * surgical injection.
 *
 * Does NOT parse or re-encode the body — the original message
 * becomes the sole sub-part of the wrapper byte-for-byte, so TNEF,
 * calendar invites, rich attachments and multi-megabyte content
 * all pass through unchanged inside the wrapper.
 */
export function prepareForPassthrough(raw: Buffer): Buffer {
  const wrapped = wrapPassthroughInEnvelope(raw);
  const stripped = stripRoutingHeadersFromTop(wrapped);
  return prependHeader(stripped, PROCESSED_HEADER, PROCESSED_HEADER_VALUE);
}

/**
 * Wrap a raw message in a new multipart/mixed envelope containing
 * a single sub-part with the original content. The original
 * top-level Content-Type / Content-Transfer-Encoding / MIME-Version
 * are lifted down into the sub-part so the inner structure is
 * preserved exactly. This is a structural no-op for mail clients
 * (they flatten single-child multiparts) but critically it gives
 * the top of the message a new random boundary, which is enough
 * to make Exchange treat the message as new in its hop-count
 * tracking.
 */
function wrapPassthroughInEnvelope(raw: Buffer): Buffer {
  const { end, sep } = findHeadersEnd(raw);
  const sepLen = sep === "\r\n" ? 4 : 2;
  const headersBlock = raw.slice(0, end).toString("utf-8");
  const body = raw.slice(end + sepLen);

  const boundary = `----=_esp_pt_${randomUUID().replace(/-/g, "")}`;

  const originalContentType =
    getHeaderValue(headersBlock, "Content-Type") || "text/plain";
  const originalCte =
    getHeaderValue(headersBlock, "Content-Transfer-Encoding") || null;
  const originalMimeVersion =
    getHeaderValue(headersBlock, "MIME-Version") || "1.0";

  const topHeaders = removeHeaders(headersBlock, [
    "content-type",
    "content-transfer-encoding",
    "mime-version",
  ]);

  const newTopHeaders =
    topHeaders +
    "\r\n" +
    `MIME-Version: ${originalMimeVersion}\r\n` +
    `Content-Type: multipart/mixed; boundary="${boundary}"`;

  const firstPartHeaders =
    `Content-Type: ${originalContentType}\r\n` +
    (originalCte ? `Content-Transfer-Encoding: ${originalCte}\r\n` : "") +
    `MIME-Version: ${originalMimeVersion}\r\n`;

  const newBody = Buffer.concat([
    Buffer.from(`--${boundary}\r\n${firstPartHeaders}\r\n`),
    body,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);

  return Buffer.concat([
    Buffer.from(newTopHeaders),
    Buffer.from("\r\n\r\n"),
    newBody,
  ]);
}

/**
 * Wrap a raw message in a new multipart/related envelope, with the
 * original message as the first part and the PNG as the second.
 *
 * The caller must have already modified the text/html in the
 * original message to reference cid:{signatureCid} so Outlook can
 * resolve it to the PNG part.
 *
 * Result is a new raw MIME buffer with the original Content-Type
 * lifted into the first sub-part and a new Content-Type at the top.
 */
function wrapWithPngAttachment(
  raw: Buffer,
  signaturePng: Buffer,
  signatureCid: string
): Buffer {
  const { end, sep } = findHeadersEnd(raw);
  const sepLen = sep === "\r\n" ? 4 : 2; // length of the blank-line separator
  const headersBlock = raw.slice(0, end).toString("utf-8");
  const body = raw.slice(end + sepLen);

  // Generate a boundary guaranteed not to collide with anything the
  // original message already uses.
  const boundary = `----=_esp_${randomUUID().replace(/-/g, "")}`;

  // Lift the original Content-Type and Content-Transfer-Encoding
  // out of the top headers — they now belong to the first sub-part.
  const originalContentType =
    getHeaderValue(headersBlock, "Content-Type") || "text/plain";
  const originalCte =
    getHeaderValue(headersBlock, "Content-Transfer-Encoding") || null;
  const originalMimeVersion =
    getHeaderValue(headersBlock, "MIME-Version") || "1.0";

  const topHeaders = removeHeaders(headersBlock, [
    "content-type",
    "content-transfer-encoding",
    "mime-version",
  ]);

  const newTopHeaders =
    topHeaders +
    "\r\n" +
    `MIME-Version: ${originalMimeVersion}\r\n` +
    `Content-Type: multipart/related; type="${originalContentType.split(";")[0].trim()}"; boundary="${boundary}"`;

  // First sub-part: the original message body with its original
  // Content-Type lifted back onto it.
  const firstPartHeaders =
    `Content-Type: ${originalContentType}\r\n` +
    (originalCte ? `Content-Transfer-Encoding: ${originalCte}\r\n` : "") +
    `MIME-Version: ${originalMimeVersion}\r\n`;

  // Second sub-part: the signature PNG.
  const pngBase64 = signaturePng.toString("base64").match(/.{1,76}/g) || [];
  const pngPartHeaders =
    `Content-Type: image/png; name="signature.png"\r\n` +
    `Content-Transfer-Encoding: base64\r\n` +
    `Content-ID: <${signatureCid}>\r\n` +
    `Content-Disposition: inline; filename="signature.png"\r\n`;

  const newBody = Buffer.concat([
    Buffer.from(`--${boundary}\r\n${firstPartHeaders}\r\n`),
    body,
    Buffer.from(
      `\r\n--${boundary}\r\n${pngPartHeaders}\r\n${pngBase64.join("\r\n")}\r\n--${boundary}--\r\n`
    ),
  ]);

  return Buffer.concat([
    Buffer.from(newTopHeaders),
    Buffer.from("\r\n\r\n"),
    newBody,
  ]);
}

/**
 * Main entrypoint for the signed path. Modifies text/html and
 * text/plain inside the raw message to include the signature
 * snippet / footer, wraps the whole thing in a new multipart/related
 * envelope that adds the PNG, strips accumulated routing headers
 * to avoid hop-count issues, and stamps X-ESP-Processed.
 *
 * Returns { raw, hasHtml } where hasHtml indicates whether we
 * actually found a text/html part to modify. If false, the caller
 * should fall back to a path that synthesises HTML (otherwise the
 * CID image reference is missing and the PNG shows as a dangling
 * attachment — e.g. Outlook Rich Text / TNEF emails that come in
 * with only text/plain + application/ms-tnef).
 *
 * Does NOT parse or re-encode existing attachments, TNEF content,
 * or calendar invites — they pass through byte-identical.
 */
export async function injectSignatureSurgically(
  input: SignatureInjectionInput
): Promise<{ raw: Buffer; hasHtml: boolean }> {
  // 1. Modify text/html + text/plain in place, preserving encoding.
  const {
    modified: htmlModified,
    hasHtml,
  } = await rewriteBodyPartsWithMailsplit(
    input.rawMessage,
    input.insertHtml,
    input.htmlSnippet,
    input.insertText,
    input.textFooter
  );

  // 2. Wrap in multipart/related + PNG sibling.
  const withPng = wrapWithPngAttachment(
    htmlModified,
    input.signaturePng,
    input.signatureCid
  );

  // 3. Strip accumulated routing headers to stop hop-count explosions
  //    on long reply chains / looped messages.
  const stripped = stripReceivedHeadersFromTop(withPng);

  // 4. Stamp the loop-guard header.
  const raw = prependHeader(
    stripped,
    PROCESSED_HEADER,
    PROCESSED_HEADER_VALUE
  );

  return { raw, hasHtml };
}
