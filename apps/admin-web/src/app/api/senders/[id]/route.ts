import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { senderToDto } from "@/lib/senders";
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
    return NextResponse.json(senderToDto(sender));
  } catch (err) {
    return errorResponse(err);
  }
}

export async function PUT(req: NextRequest, { params }: Ctx) {
  try {
    requireAuth(req);
    const { id } = await params;
    const body = await req.json();
    const existing = await prisma.sender.findUnique({ where: { id } });
    if (!existing) throw new ApiError(404, "Sender not found");
    const sender = await prisma.sender.update({
      where: { id },
      data: {
        email: body.email ?? undefined,
        name: body.name ?? undefined,
        title: body.title ?? undefined,
        phone: body.phone ?? undefined,
        phone2: body.phone2 ?? undefined,
        enabled: body.enabled ?? undefined,
        imageKey: body.imageKey ?? undefined,
      },
    });
    return NextResponse.json(senderToDto(sender));
  } catch (err) {
    return errorResponse(err);
  }
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  try {
    requireAuth(req);
    const { id } = await params;
    const existing = await prisma.sender.findUnique({ where: { id } });
    if (!existing) throw new ApiError(404, "Sender not found");
    await prisma.sender.delete({ where: { id } });
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    return errorResponse(err);
  }
}
