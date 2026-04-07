import { callExchangeCmdlet } from "./exchange-rest";
import { getPublicBaseUrl } from "./signature-html";

/**
 * Server-side signature mode using a single Exchange Online transport
 * rule (mail flow rule). Microsoft natively supports per-user disclaimers
 * via %% tokens that pull from the sender's Entra ID profile, so we use
 * that instead of running our own SMTP processor.
 *
 * The rule:
 *   - Applies to ALL outbound messages (SentToScope = NotInOrganization)
 *   - Adds an HTML disclaimer at the bottom containing a hot-linked PNG
 *     of the sender's signature, with %%UserPrincipalName%% in the URL
 *     so each sender gets their own image
 *   - Has an exception that looks for our unique marker comment so the
 *     signature isn't appended twice on replies / forwards
 */

const RULE_NAME = "ChaiiwalaEmailSignaturePlatform";
const DEDUP_MARKER = "ESP-SIG-V1";

// Display size for the signature image embedded in every outbound
// email by the transport rule. Must match png-renderer.ts so the
// recipient's email client doesn't softly rescale it.
const SIG_WIDTH = 314;
const SIG_HEIGHT = 154;

function buildDisclaimerHtml(disclaimer: string): string {
  const base = getPublicBaseUrl();
  if (!base) {
    throw new Error(
      "PUBLIC_APP_URL / VERCEL_PROJECT_PRODUCTION_URL not set — cannot build a hot-link URL for the signature image"
    );
  }
  const imgUrl = `${base}/api/signature.png?email=%%UserPrincipalName%%`;

  // The HTML stays under Microsoft's 5000-char disclaimer limit, uses
  // only inline styles (since some clients strip <style>), and embeds
  // the dedup marker as an HTML comment that won't render but can be
  // matched by the rule exception.
  const safeDisclaimer = (disclaimer || "").trim();

  const parts = [
    `<!--${DEDUP_MARKER}-->`,
    `<br/><br/>`,
    `<img src="${imgUrl}" width="${SIG_WIDTH}" height="${SIG_HEIGHT}" alt="Chaiiwala signature" style="display:block;width:${SIG_WIDTH}px;height:${SIG_HEIGHT}px;border:0;outline:none;text-decoration:none;" />`,
  ];

  if (safeDisclaimer) {
    parts.push(
      `<div style="margin-top:14px;max-width:640px;font-family:Arial,Helvetica,sans-serif;font-size:8px;font-style:italic;line-height:1.5;color:#333333;">${safeDisclaimer}</div>`
    );
  }

  return parts.join("");
}

export async function getServerSideRule(): Promise<any | null> {
  try {
    const result = await callExchangeCmdlet("Get-TransportRule", {
      Identity: RULE_NAME,
    });
    // Result shape: { value: [ { ... } ] } OR { ... } depending on cmdlet
    return result?.value?.[0] ?? result ?? null;
  } catch (err: any) {
    // Rule doesn't exist (normal first-run state). The Exchange REST
    // cmdlet API returns 404 in this case, sometimes with no helpful
    // message. Treat any 404, or messages mentioning "not found"/
    // "doesn't exist", as "rule absent" rather than an error.
    if (
      err?.status === 404 ||
      err?.message?.includes("404") ||
      err?.message?.includes("couldn't be found") ||
      err?.message?.includes("Cannot find") ||
      err?.message?.includes("does not exist") ||
      err?.message?.includes("not found")
    ) {
      return null;
    }
    throw err;
  }
}

export type SignatureScope = "external" | "all";

export async function enableServerSideRule(
  disclaimer: string,
  scope: SignatureScope = "all"
): Promise<void> {
  const html = buildDisclaimerHtml(disclaimer);

  if (html.length > 5000) {
    throw new Error(
      `Generated disclaimer HTML is ${html.length} chars, exceeds Microsoft's 5000-char transport rule limit. Shorten the disclaimer text.`
    );
  }

  const existing = await getServerSideRule();

  // Scope translates to either restricting to external recipients via
  // SentToScope, or applying to every message by leaving the scope
  // unrestricted (matched on the dedup-marker exception only).
  const scopeParams =
    scope === "external"
      ? { SentToScope: "NotInOrganization" }
      : {};

  const sharedParams = {
    Enabled: true,
    ApplyHtmlDisclaimerLocation: "Append",
    ApplyHtmlDisclaimerText: html,
    ApplyHtmlDisclaimerFallbackAction: "Wrap",
    // Don't add the signature twice on replies / forwards
    ExceptIfSubjectOrBodyContainsWords: DEDUP_MARKER,
    Mode: "Enforce",
    ...scopeParams,
  };

  if (existing) {
    // When updating, we need to explicitly clear SentToScope if we're
    // moving from external-only to all, otherwise the old restriction
    // sticks. Set-TransportRule treats $null as "remove this filter".
    const updateParams: Record<string, unknown> = {
      Identity: RULE_NAME,
      ...sharedParams,
    };
    if (scope === "all") {
      updateParams.SentToScope = null;
    }
    await callExchangeCmdlet("Set-TransportRule", updateParams);
  } else {
    await callExchangeCmdlet("New-TransportRule", {
      Name: RULE_NAME,
      ...sharedParams,
    });
  }
}

export async function disableServerSideRule(): Promise<void> {
  const existing = await getServerSideRule();
  if (!existing) return;
  await callExchangeCmdlet("Remove-TransportRule", {
    Identity: RULE_NAME,
    Confirm: false,
  });
}

export const SERVER_SIDE_RULE_NAME = RULE_NAME;
export const SERVER_SIDE_DEDUP_MARKER = DEDUP_MARKER;
