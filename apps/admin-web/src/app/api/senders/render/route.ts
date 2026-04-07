import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { renderSignatureHtml } from "@esp/signature-renderer";
import { errorResponse } from "@/lib/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    requireAuth(req);
    const body = await req.json();
    const settings = await prisma.globalSettings.findUnique({
      where: { id: "singleton" },
    });
    const html = renderSignatureHtml({
      senderName: body.name,
      senderTitle: body.title ?? null,
      senderPhone: body.phone ?? null,
      senderPhone2: body.phone2 ?? null,
      addressLine1: settings?.addressLine1 ?? "",
      addressLine2: settings?.addressLine2 ?? "",
      website: settings?.website ?? "",
      logoUrl: settings?.logoUrl ?? "",
      badgeUrl: settings?.badgeUrl ?? "",
    });
    return NextResponse.json({ html });
  } catch (err) {
    return errorResponse(err);
  }
}
