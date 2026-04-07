import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { callExchangeCmdlet } from "@/lib/exchange-rest";
import { errorResponse } from "@/lib/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * One-shot endpoint that flips the Exchange Online tenant flag
 * `PostponeRoamingSignaturesUntilLater` to false, which makes the
 * Microsoft Graph signatureSettings endpoint usable. After running
 * this you should wait ~5 minutes for the change to propagate, then
 * the platform's "Deploy to Outlook" feature will work.
 */
export async function POST(req: NextRequest) {
  try {
    requireAuth(req);

    // Read current state for the response message
    let before: any = null;
    try {
      before = await callExchangeCmdlet("Get-OrganizationConfig", {});
    } catch {
      // ignore — we still want to attempt the set even if read fails
    }

    await callExchangeCmdlet("Set-OrganizationConfig", {
      PostponeRoamingSignaturesUntilLater: false,
    });

    const after = await callExchangeCmdlet("Get-OrganizationConfig", {});
    const value =
      after?.value?.[0]?.PostponeRoamingSignaturesUntilLater ??
      after?.PostponeRoamingSignaturesUntilLater ??
      null;

    return NextResponse.json({
      success: true,
      message:
        "Roaming Signatures enabled. Wait ~5 minutes for the change to propagate, then deploy a sender to test.",
      previousValue:
        before?.value?.[0]?.PostponeRoamingSignaturesUntilLater ??
        before?.PostponeRoamingSignaturesUntilLater ??
        null,
      currentValue: value,
    });
  } catch (err) {
    return errorResponse(err);
  }
}
