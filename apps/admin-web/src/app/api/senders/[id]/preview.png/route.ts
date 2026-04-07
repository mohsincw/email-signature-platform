import { type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { renderSignaturePng } from "@/lib/png-renderer";
import { errorResponse } from "@/lib/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

type Ctx = { params: Promise<{ id: string }> };

// Public endpoint — no auth needed because the URL is what we paste
// into Outlook signatures. Anyone with the URL can view the PNG.
export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    const sender = await prisma.sender.findUnique({ where: { id } });
    if (!sender) {
      return new Response("Sender not found", { status: 404 });
    }
    const settings = await prisma.globalSettings.findUnique({
      where: { id: "singleton" },
    });

    const png = await renderSignaturePng({
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

    return new Response(new Uint8Array(png), {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=300, s-maxage=300",
      },
    });
  } catch (err) {
    return errorResponse(err);
  }
}
