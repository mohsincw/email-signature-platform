import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { errorResponse } from "@/lib/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Live activity feed for the Console page.
 *
 * Query params:
 *   - limit (default 50, max 200)     — how many most-recent rows to return
 *   - since (ISO timestamp, optional) — only return rows created after this
 *
 * Response: { events: EventDto[], stats: { total, signed, passthrough, error } }
 *   - events is newest-first
 *   - stats is a 24h rollup so the Console header can show counts
 */
export async function GET(req: NextRequest) {
  try {
    requireAuth(req);

    const url = new URL(req.url);
    const limitParam = Number(url.searchParams.get("limit") ?? "50");
    const limit = Number.isFinite(limitParam)
      ? Math.min(Math.max(limitParam, 1), 200)
      : 50;
    const sinceParam = url.searchParams.get("since");
    const since = sinceParam ? new Date(sinceParam) : null;

    const where = since && !isNaN(since.getTime())
      ? { createdAt: { gt: since } }
      : undefined;

    const [rows, stats] = await Promise.all([
      prisma.mailEvent.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
      }),
      // 24h rollup counts for the header strip
      (async () => {
        const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const grouped = await prisma.mailEvent.groupBy({
          by: ["status"],
          where: { createdAt: { gte: dayAgo } },
          _count: { _all: true },
        });
        const out = {
          total: 0,
          signed: 0,
          passthrough: 0,
          already_processed: 0,
          error: 0,
        };
        for (const g of grouped) {
          const count = g._count._all;
          out.total += count;
          if (g.status === "signed") out.signed = count;
          else if (g.status === "passthrough") out.passthrough = count;
          else if (g.status === "already_processed")
            out.already_processed = count;
          else if (g.status === "error") out.error = count;
        }
        return out;
      })(),
    ]);

    const events = rows.map((r) => ({
      id: r.id,
      createdAt: r.createdAt.toISOString(),
      senderEmail: r.senderEmail,
      senderName: r.senderName,
      recipients: r.recipients,
      status: r.status,
      reason: r.reason,
      errorMessage: r.errorMessage,
      originalBytes: r.originalBytes,
      rewrittenBytes: r.rewrittenBytes,
    }));

    return NextResponse.json({ events, stats });
  } catch (err) {
    return errorResponse(err);
  }
}
