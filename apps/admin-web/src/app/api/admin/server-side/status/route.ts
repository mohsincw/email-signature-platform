import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import {
  getServerSideRule,
  SERVER_SIDE_RULE_NAME,
} from "@/lib/transport-rule";
import { errorResponse } from "@/lib/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(req: NextRequest) {
  try {
    requireAuth(req);
    const rule = await getServerSideRule();
    return NextResponse.json({
      enabled: !!rule,
      ruleName: SERVER_SIDE_RULE_NAME,
      state: rule?.State ?? rule?.state ?? null,
      mode: rule?.Mode ?? rule?.mode ?? null,
      lastModified: rule?.WhenChanged ?? rule?.whenChanged ?? null,
    });
  } catch (err) {
    return errorResponse(err);
  }
}
