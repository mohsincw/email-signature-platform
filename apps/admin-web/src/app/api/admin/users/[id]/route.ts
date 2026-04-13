import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { errorResponse, ApiError } from "@/lib/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    requireAuth(req);
    const { id } = await params;
    const body = await req.json();

    const data: Record<string, unknown> = {};
    if ("pin" in body) {
      const pin = body.pin === null || body.pin === "" ? null : String(body.pin).trim();
      if (pin !== null && !/^\d{4,8}$/.test(pin)) {
        throw new ApiError(400, "PIN must be 4–8 digits");
      }
      data.pin = pin;
    }

    const user = await prisma.adminUser.update({
      where: { id },
      data,
      select: {
        id: true,
        email: true,
        name: true,
        pin: true,
        role: true,
        createdAt: true,
      },
    });
    return NextResponse.json(user);
  } catch (err) {
    return errorResponse(err);
  }
}
