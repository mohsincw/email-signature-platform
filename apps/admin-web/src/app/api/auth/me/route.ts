import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { ApiError, errorResponse } from "@/lib/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const payload = requireAuth(req);
    const user = await prisma.adminUser.findUnique({
      where: { id: payload.sub },
    });
    if (!user) throw new ApiError(401, "User not found");
    return NextResponse.json({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    });
  } catch (err) {
    return errorResponse(err);
  }
}
