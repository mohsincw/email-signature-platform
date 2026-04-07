import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { enableServerSideRule, type SignatureScope } from "@/lib/transport-rule";
import { errorResponse } from "@/lib/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  try {
    requireAuth(req);
    const body = await req.json().catch(() => ({}));
    const scope: SignatureScope =
      body?.scope === "external" ? "external" : "all";

    const settings = await prisma.globalSettings.findUnique({
      where: { id: "singleton" },
    });
    await enableServerSideRule(settings?.disclaimer ?? "", scope);
    return NextResponse.json({
      success: true,
      scope,
      message:
        scope === "all"
          ? "Server-side mode enabled for ALL outbound emails (internal + external). Wait ~5 minutes for the rule to propagate. The dedup marker will prevent signature stacking on reply chains."
          : "Server-side mode enabled for EXTERNAL recipients only. Internal emails between Chaiiwala users will not get the signature. Wait ~5 minutes for the rule to propagate.",
    });
  } catch (err) {
    return errorResponse(err);
  }
}
