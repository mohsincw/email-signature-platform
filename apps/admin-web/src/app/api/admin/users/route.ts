import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { errorResponse } from "@/lib/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    requireAuth(req);
    const users = await prisma.adminUser.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        email: true,
        name: true,
        pin: true,
        role: true,
        createdAt: true,
      },
    });
    return NextResponse.json(users);
  } catch (err) {
    return errorResponse(err);
  }
}
