import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { disableServerSideRule } from "@/lib/transport-rule";
import { errorResponse } from "@/lib/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  try {
    requireAuth(req);
    await disableServerSideRule();
    return NextResponse.json({
      success: true,
      message:
        "Server-side mode disabled. The transport rule has been removed and signatures will no longer be appended automatically.",
    });
  } catch (err) {
    return errorResponse(err);
  }
}
