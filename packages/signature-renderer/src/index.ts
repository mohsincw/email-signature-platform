import type { SignatureRenderInput } from "@esp/shared-types";

/**
 * Renders the Chaiiwala email signature as HTML.
 *
 * Layout matches the official Chaiiwala signature format:
 * ┌─────────────┬──────────────────────────────┐
 * │  logo       │  name (bold, lowercase)       │
 * │  chaiiwala® │  TITLE (uppercase, spaced)    │
 * │             │                               │
 * │  [badge]    │  +44 (0) XXXX XXX XXX        │
 * │             │                               │
 * │             │  ADDRESS LINE 1               │
 * │             │  CITY • POSTCODE • COUNTRY    │
 * │             │                               │
 * │             │  www.chaiiwala.co.uk          │
 * └─────────────┴──────────────────────────────┘
 *
 * Uses HTML tables for maximum email client compatibility.
 */
export function renderSignatureHtml(input: SignatureRenderInput): string {
  const {
    senderName,
    senderTitle,
    senderPhone,
    senderPhone2,
    addressLine1,
    addressLine2,
    website,
    logoUrl,
    badgeUrl,
  } = input;

  const font = "'Helvetica Neue', Helvetica, Arial, sans-serif";

  // Left column: logo + badge
  let leftCol = '';
  if (logoUrl) {
    leftCol += `<img src="${esc(logoUrl)}" alt="chaiiwala" width="140" style="display:block;width:140px;height:auto;" />`;
  }
  if (badgeUrl) {
    leftCol += `<img src="${esc(badgeUrl)}" alt="5 Star Franchisee Satisfaction" width="120" style="display:block;width:120px;height:auto;margin-top:10px;" />`;
  }

  // Right column: contact details
  let rightCol = '';

  // Name — bold, lowercase, 30px
  rightCol += `<p style="margin:0 0 6px;font-family:${font};font-size:30px;font-weight:700;color:#000000;line-height:1.15;">${esc(senderName)}</p>`;

  // Title — uppercase, letter-spaced, 12px
  if (senderTitle) {
    rightCol += `<p style="margin:0 0 18px;font-family:${font};font-size:12px;font-weight:600;color:#000000;text-transform:uppercase;letter-spacing:3px;line-height:1.3;">${esc(senderTitle)}</p>`;
  }

  // Phone — bold, 26px
  if (senderPhone && senderPhone2) {
    rightCol += `<p style="margin:0;font-family:${font};font-size:26px;font-weight:700;color:#000000;line-height:1.4;">${esc(senderPhone)}</p>`;
    rightCol += `<p style="margin:0 0 28px;font-family:${font};font-size:26px;font-weight:700;color:#000000;line-height:1.4;">${esc(senderPhone2)}</p>`;
  } else if (senderPhone) {
    rightCol += `<p style="margin:0 0 28px;font-family:${font};font-size:26px;font-weight:700;color:#000000;line-height:1.2;">${esc(senderPhone)}</p>`;
  }

  // Address line 1 — 11px
  if (addressLine1) {
    rightCol += `<p style="margin:0;font-family:${font};font-size:11px;font-weight:600;color:#000000;text-transform:uppercase;letter-spacing:2px;line-height:1.6;">${esc(addressLine1)}</p>`;
  }

  // Address line 2 — 11px
  if (addressLine2) {
    rightCol += `<p style="margin:0 0 22px;font-family:${font};font-size:11px;font-weight:600;color:#000000;text-transform:uppercase;letter-spacing:2px;line-height:1.6;">${esc(addressLine2)}</p>`;
  }

  // Website — "chaiiwala" bold 20px, rest normal 16px
  if (website) {
    const websiteDisplay = website.replace(/^https?:\/\//, '');
    const match = websiteDisplay.match(/^(www\.)(chaiiwala)(\.co\.uk)$/i);
    if (match) {
      rightCol += `<a href="https://${esc(websiteDisplay)}" style="margin:0;font-family:${font};font-size:16px;font-weight:400;color:#000000;text-decoration:none;line-height:1.2;">${esc(match[1])}<span style="font-weight:800;font-size:20px;">${esc(match[2])}</span>${esc(match[3])}</a>`;
    } else {
      rightCol += `<a href="https://${esc(websiteDisplay)}" style="margin:0;font-family:${font};font-size:16px;font-weight:700;color:#000000;text-decoration:none;line-height:1.2;">${esc(websiteDisplay)}</a>`;
    }
  }

  return [
    '<div style="margin-top:20px;">',
    '<table cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">',
    '<tr>',
    // Left column — logo + badge
    `<td style="vertical-align:top;padding-right:24px;border-right:2px solid #000000;width:150px;" valign="top">`,
    leftCol,
    '</td>',
    // Right column — contact info
    `<td style="vertical-align:top;padding-left:24px;" valign="top">`,
    rightCol,
    '</td>',
    '</tr>',
    '</table>',
    '</div>',
  ].join('\n');
}

export function renderSignaturePlain(
  senderName: string,
  senderTitle: string | null,
  senderPhone: string | null,
  senderPhone2: string | null,
  addressLine1: string,
  addressLine2: string,
  website: string
): string {
  const lines: string[] = ["", "---", senderName];

  if (senderTitle) {
    lines.push(senderTitle);
  }

  if (senderPhone) {
    lines.push(senderPhone);
  }

  if (senderPhone2) {
    lines.push(senderPhone2);
  }

  if (addressLine1) {
    lines.push(addressLine1);
  }

  if (addressLine2) {
    lines.push(addressLine2);
  }

  if (website) {
    lines.push(website);
  }

  return lines.join("\n");
}

function esc(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
