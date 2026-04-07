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

export function buildPngSignatureHtml(
  senderId: string,
  disclaimer: string
): string {
  const base = getPublicBaseUrl();
  const pngUrl = `${base}/api/senders/${senderId}/preview.png`;

  // 540px is a safe email-client width that still looks crisp on retina
  // because the PNG is rendered at 1440px and downscaled by the client.
  const imgTag = `<img src="${pngUrl}" alt="Chaiiwala signature" width="540" style="display:block;width:540px;max-width:100%;height:auto;border:0;outline:none;text-decoration:none;" />`;

  const disclaimerBlock = disclaimer
    ? `<div style="margin-top:18px;max-width:640px;font-family:'Myriad Pro','Source Sans Pro','Open Sans','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:11px;font-style:italic;line-height:1.5;color:#525252;">${disclaimer}</div>`
    : "";

  return `<div style="margin-top:20px;">${imgTag}${disclaimerBlock}</div>`;
}
