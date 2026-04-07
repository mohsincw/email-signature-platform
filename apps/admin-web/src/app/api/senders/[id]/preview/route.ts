import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { renderSignatureHtml } from "@esp/signature-renderer";
import { ApiError, errorResponse } from "@/lib/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Ctx) {
  try {
    requireAuth(req);
    const { id } = await params;
    const sender = await prisma.sender.findUnique({ where: { id } });
    if (!sender) throw new ApiError(404, "Sender not found");
    const settings = await prisma.globalSettings.findUnique({
      where: { id: "singleton" },
    });
    const html = renderSignatureHtml({
      senderName: sender.name,
      senderTitle: sender.title,
      senderPhone: sender.phone,
      senderPhone2: sender.phone2,
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
