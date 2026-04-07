import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { senderToDto } from "@/lib/senders";
import { errorResponse } from "@/lib/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Public endpoint — used by mail-processor to look up senders by email.
export async function GET(req: NextRequest) {
  try {
    const email = req.nextUrl.searchParams.get("email");
    if (!email) return NextResponse.json(null);
    const sender = await prisma.sender.findUnique({ where: { email } });
    return NextResponse.json(sender ? senderToDto(sender) : null);
  } catch (err) {
    return errorResponse(err);
  }
}
