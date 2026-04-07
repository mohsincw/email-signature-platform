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
    disclaimer,
  } = input;

  // Brand-approved primary typeface is Myriad Pro. Email clients can't load
  // arbitrary web fonts, so we list it first (Adobe Creative Cloud users have
  // it installed) and fall back to the closest near-equivalents available on
  // Mac, Windows, and Linux.
  const font =
    "'Myriad Pro', 'Source Sans Pro', 'Open Sans', 'Helvetica Neue', Helvetica, Arial, sans-serif";

  // Left column: logo + badge (wrapped in a fixed-width div so centring
  // is reliable across all email clients regardless of how the parent
  // <td> auto-sizes).
  let leftCol = '<div style="width:170px;text-align:center;margin:0 auto;">';
  if (logoUrl) {
    leftCol += `<img src="${esc(logoUrl)}" alt="chaiiwala" width="140" style="display:block;width:140px;height:auto;margin:0 auto;" />`;
  }
  if (badgeUrl) {
    leftCol += `<img src="${esc(badgeUrl)}" alt="5 Star Franchisee Satisfaction" width="120" style="display:block;width:120px;height:auto;margin:14px auto 0;" />`;
  }
  leftCol += '</div>';

  // Right column: contact details
  let rightCol = '';

  // Name — bold, lowercase, 30px
  rightCol += `<p style="margin:0 0 6px;font-family:${font};font-size:30px;font-weight:700;color:#000000;line-height:1.15;">${esc(senderName)}</p>`;

  // Title — uppercase, letter-spaced, 12px
  if (senderTitle) {
    rightCol += `<p style="margin:0 0 18px;font-family:${font};font-size:12px;font-weight:600;color:#000000;text-transform:uppercase;letter-spacing:2px;line-height:1.3;">${esc(senderTitle)}</p>`;
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
    rightCol += `<p style="margin:0;font-family:${font};font-size:11px;font-weight:600;color:#000000;text-transform:uppercase;letter-spacing:1.5px;line-height:1.6;">${esc(addressLine1)}</p>`;
  }

  // Address line 2 — 11px
  if (addressLine2) {
    rightCol += `<p style="margin:0 0 22px;font-family:${font};font-size:11px;font-weight:600;color:#000000;text-transform:uppercase;letter-spacing:1.5px;line-height:1.6;">${esc(addressLine2)}</p>`;
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

  const disclaimerBlock = disclaimer
    ? `\n<div style="margin-top:22px;max-width:640px;font-family:${font};font-size:11px;font-style:italic;line-height:1.5;color:#525252;">${disclaimer}</div>`
    : '';

  return [
    '<div style="margin-top:20px;">',
    '<table cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">',
    '<tr>',
    // Left column — fixed 200px wide so logo and badge always centre cleanly
    `<td align="center" style="vertical-align:middle;text-align:center;padding:0 28px 0 0;border-right:2px solid #000000;width:200px;" valign="middle" width="200">`,
    leftCol,
    '</td>',
    // Right column — contact info
    `<td style="vertical-align:top;padding-left:24px;" valign="top">`,
    rightCol,
    '</td>',
    '</tr>',
    '</table>',
    disclaimerBlock,
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
