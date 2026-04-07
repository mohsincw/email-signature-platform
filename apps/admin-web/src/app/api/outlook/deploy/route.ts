import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { deploySignature } from "@/lib/outlook";
import { ApiError, errorResponse } from "@/lib/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const payload = requireAuth(req);
    const body = await req.json();
    if (!Array.isArray(body?.senderIds) || body.senderIds.length === 0) {
      throw new ApiError(400, "senderIds must be a non-empty array");
    }
    const results = [];
    for (const id of body.senderIds) {
      const result = await deploySignature(id, payload.sub);
      results.push(result);
      if (body.senderIds.length > 1) {
        await new Promise((r) => setTimeout(r, 200));
      }
    }
    return NextResponse.json(results);
  } catch (err) {
    return errorResponse(err);
  }
}
