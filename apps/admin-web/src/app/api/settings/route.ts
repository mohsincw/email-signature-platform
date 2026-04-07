import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { errorResponse } from "@/lib/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function toDto(s: {
  addressLine1: string;
  addressLine2: string;
  website: string;
  logoUrl: string;
  badgeUrl: string;
  disclaimer: string;
}) {
  return {
    addressLine1: s.addressLine1,
    addressLine2: s.addressLine2,
    website: s.website,
    logoUrl: s.logoUrl,
    badgeUrl: s.badgeUrl,
    disclaimer: s.disclaimer,
  };
}

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
        disclaimer: "",
      },
    });
    return NextResponse.json(toDto(settings));
  } catch (err) {
    return errorResponse(err);
  }
}

export async function PUT(req: NextRequest) {
  try {
    requireAuth(req);
    const dto = await req.json();
    const data = {
      addressLine1: dto.addressLine1 ?? "",
      addressLine2: dto.addressLine2 ?? "",
      website: dto.website ?? "",
      logoUrl: dto.logoUrl ?? "",
      badgeUrl: dto.badgeUrl ?? "",
      disclaimer: dto.disclaimer ?? "",
    };
    const settings = await prisma.globalSettings.upsert({
      where: { id: "singleton" },
      update: data,
      create: data,
    });
    return NextResponse.json(toDto(settings));
  } catch (err) {
    return errorResponse(err);
  }
}
