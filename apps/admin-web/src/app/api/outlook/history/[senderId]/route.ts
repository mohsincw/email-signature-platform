import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { errorResponse } from "@/lib/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ senderId: string }> };

export async function GET(req: NextRequest, { params }: Ctx) {
  try {
    requireAuth(req);
    const { senderId } = await params;
    const logs = await prisma.deploymentLog.findMany({
      where: { senderId },
      orderBy: { deployedAt: "desc" },
      take: 10,
    });
    return NextResponse.json(
      logs.map((l) => ({
        id: l.id,
        senderId: l.senderId,
        target: l.target,
        status: l.status,
        error: l.error,
        deployedAt: l.deployedAt.toISOString(),
        deployedBy: l.deployedBy,
      }))
    );
  } catch (err) {
    return errorResponse(err);
  }
}
