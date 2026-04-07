import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { enableServerSideRule } from "@/lib/transport-rule";
import { errorResponse } from "@/lib/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  try {
    requireAuth(req);
    const settings = await prisma.globalSettings.findUnique({
      where: { id: "singleton" },
    });
    await enableServerSideRule(settings?.disclaimer ?? "");
    return NextResponse.json({
      success: true,
      message:
        "Server-side mode enabled. Outbound emails to external recipients will now have a Chaiiwala signature appended automatically by Exchange Online. Wait ~5 minutes for the rule to propagate.",
    });
  } catch (err) {
    return errorResponse(err);
  }
}
