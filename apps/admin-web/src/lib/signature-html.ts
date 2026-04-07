/**
 * The HTML the user's mailbox actually receives. Wraps a hot-linked
 * PNG of the signature top section so every recipient sees pixel-
 * perfect Myriad Pro regardless of their email client. The disclaimer
 * is appended as live HTML below the image so it stays indexable,
 * accessible, and copy-pasteable.
 */

/**
 * Resolve the canonical public URL of this deployment so the PNG
 * embedded in the signature can be hot-linked from Outlook.
 *
 * Override priority:
 *   1. PUBLIC_APP_URL                — explicit, e.g. https://emailsignatures.chaiiwala.co.uk
 *   2. VERCEL_PROJECT_PRODUCTION_URL — set by Vercel for the canonical prod domain
 *   3. VERCEL_URL                    — set by Vercel for the per-deploy URL
 */
export function getPublicBaseUrl(): string {
  const explicit = process.env.PUBLIC_APP_URL?.replace(/\/$/, "");
  if (explicit) return explicit;
  const prod = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (prod) return `https://${prod}`;
  const vercel = process.env.VERCEL_URL;
  if (vercel) return `https://${vercel}`;
  return "";
}

// Display size for the embedded signature image — must match what
// png-renderer.ts emits so the image isn't scaled on the recipient's
// end (which would soften it).
export const SIG_WIDTH = 314;
export const SIG_HEIGHT = 154;

export function buildPngSignatureHtml(
  senderId: string,
  disclaimer: string
): string {
  const base = getPublicBaseUrl();
  const pngUrl = `${base}/api/senders/${senderId}/preview.png`;

  // Wrap the image in a fixed-width single-cell table so Outlook
  // respects the intended 314x154 CSS size regardless of the source
  // PNG's natural pixel dimensions (which are 2x for retina sharpness).
  const imgCell = `<table cellpadding="0" cellspacing="0" border="0" width="${SIG_WIDTH}" style="border-collapse:collapse;width:${SIG_WIDTH}px;"><tr><td width="${SIG_WIDTH}" height="${SIG_HEIGHT}" style="padding:0;width:${SIG_WIDTH}px;height:${SIG_HEIGHT}px;line-height:0;font-size:0;"><img src="${pngUrl}" alt="Chaiiwala signature" width="${SIG_WIDTH}" height="${SIG_HEIGHT}" style="display:block;width:${SIG_WIDTH}px;height:${SIG_HEIGHT}px;border:0;outline:none;text-decoration:none;margin:0;padding:0;" /></td></tr></table>`;

  const disclaimerBlock = disclaimer
    ? `<div style="margin:6px 0 0 0;padding:0;max-width:640px;font-family:Arial,Helvetica,sans-serif;font-size:8px;font-style:italic;line-height:1.5;color:#333333;">${disclaimer}</div>`
    : "";

  return `<div style="margin-top:8px;">${imgCell}${disclaimerBlock}</div>`;
}
