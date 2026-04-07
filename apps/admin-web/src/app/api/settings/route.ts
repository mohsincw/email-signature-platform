import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { errorResponse } from "@/lib/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    requireAuth(req);
    const settings = await prisma.globalSettings.upsert({
      where: { id: "singleton" },
      update: {},
      create: {
        addressLine1: "",
        addressLine2: "",
        website: "",
        logoUrl: "",
        badgeUrl: "",
      },
    });
    return NextResponse.json({
      addressLine1: settings.addressLine1,
      addressLine2: settings.addressLine2,
      website: settings.website,
      logoUrl: settings.logoUrl,
      badgeUrl: settings.badgeUrl,
    });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function PUT(req: NextRequest) {
  try {
    requireAuth(req);
    const dto = await req.json();
    const settings = await prisma.globalSettings.upsert({
      where: { id: "singleton" },
      update: {
        addressLine1: dto.addressLine1 ?? "",
        addressLine2: dto.addressLine2 ?? "",
        website: dto.website ?? "",
        logoUrl: dto.logoUrl ?? "",
        badgeUrl: dto.badgeUrl ?? "",
      },
      create: {
        addressLine1: dto.addressLine1 ?? "",
        addressLine2: dto.addressLine2 ?? "",
        website: dto.website ?? "",
        logoUrl: dto.logoUrl ?? "",
        badgeUrl: dto.badgeUrl ?? "",
      },
    });
    return NextResponse.json({
      addressLine1: settings.addressLine1,
      addressLine2: settings.addressLine2,
      website: settings.website,
      logoUrl: settings.logoUrl,
      badgeUrl: settings.badgeUrl,
    });
  } catch (err) {
    return errorResponse(err);
  }
}
