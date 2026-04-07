import type { ParsedMail } from "mailparser";
import { SIGNATURE_HEADER } from "@esp/shared-types";
import { renderSignatureHtml, renderSignaturePlain } from "@esp/signature-renderer";
import { lookupSender } from "./api-client";
import { logger } from "./logger";

export async function processMessage(
  rawMessage: string,
  parsed: ParsedMail,
  senderEmail: string
): Promise<string> {
  // Check for duplicate-prevention header
  if (parsed.headers.get(SIGNATURE_HEADER.toLowerCase())) {
    logger.info({ sender: senderEmail }, "Signature already applied, skipping");
    return rawMessage;
  }

  // Look up sender via API
  const senderData = await lookupSender(senderEmail);

  if (!senderData || !senderData.sender || !senderData.sender.enabled) {
    logger.info({ sender: senderEmail }, "No active signature for sender, relaying unchanged");
    return rawMessage;
  }

  const { sender, settings } = senderData;

  logger.info({ sender: senderEmail, senderId: sender.id }, "Appending signature");

  let modified = rawMessage;

  // Append to HTML body if present
  if (parsed.html) {
    const signatureHtml = renderSignatureHtml({
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

    // Insert before closing </body> tag if present, otherwise append
    if (modified.includes("</body>")) {
      modified = modified.replace("</body>", `${signatureHtml}</body>`);
    } else if (modified.includes("</html>")) {
      modified = modified.replace("</html>", `${signatureHtml}</html>`);
    } else {
      modified += signatureHtml;
    }
  } else if (parsed.text) {
    // Plain text only: append plain text footer
    const signaturePlain = renderSignaturePlain(
      sender.name,
      sender.title,
      sender.phone,
      sender.phone2,
      settings.addressLine1,
      settings.addressLine2,
      settings.website
    );
    modified += signaturePlain;
  }

  // Add the signature-applied header
  modified = addHeader(modified, SIGNATURE_HEADER, "true");

  return modified;
}

function addHeader(rawMessage: string, name: string, value: string): string {
  // Insert header at the beginning of the message (before first blank line)
  const headerEnd = rawMessage.indexOf("\r\n\r\n");
  if (headerEnd === -1) {
    return `${name}: ${value}\r\n${rawMessage}`;
  }
  return `${rawMessage.slice(0, headerEnd)}\r\n${name}: ${value}${rawMessage.slice(headerEnd)}`;
}
