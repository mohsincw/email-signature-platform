import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { senderToDto } from "@/lib/senders";
import { ApiError, errorResponse } from "@/lib/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    requireAuth(req);
    const senders = await prisma.sender.findMany({ orderBy: { name: "asc" } });
    return NextResponse.json(senders.map(senderToDto));
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    requireAuth(req);
    const body = await req.json();
    if (!body?.email || !body?.name) {
      throw new ApiError(400, "email and name are required");
    }
    const sender = await prisma.sender.create({
      data: {
        email: String(body.email),
        name: String(body.name),
        title: body.title ?? null,
        phone: body.phone ?? null,
        phone2: body.phone2 ?? null,
      },
    });
    return NextResponse.json(senderToDto(sender));
  } catch (err) {
    return errorResponse(err);
  }
}
