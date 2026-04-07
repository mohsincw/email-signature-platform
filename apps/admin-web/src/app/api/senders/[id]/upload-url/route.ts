import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { createPresignedUploadUrl } from "@/lib/s3";
import { ApiError, errorResponse } from "@/lib/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Ctx) {
  try {
    requireAuth(req);
    const { id } = await params;
    const sender = await prisma.sender.findUnique({ where: { id } });
    if (!sender) throw new ApiError(404, "Sender not found");
    const key = `signatures/${id}/${Date.now()}.png`;
    const uploadUrl = await createPresignedUploadUrl(key);
    return NextResponse.json({ uploadUrl, key });
  } catch (err) {
    return errorResponse(err);
  }
}
