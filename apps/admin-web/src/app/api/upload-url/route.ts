import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { createPresignedUploadUrl, s3PublicUrl } from "@/lib/s3";
import { ApiError, errorResponse } from "@/lib/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Generic presigned upload endpoint for global brand assets and other
 * one-off uploads. POST { kind: "logo" | "badge" | "sender", contentType }
 * returns { uploadUrl, key, publicUrl }.
 */
export async function POST(req: NextRequest) {
  try {
    requireAuth(req);
    const body = await req.json();
    const kind = String(body?.kind ?? "asset");
    const contentType = String(body?.contentType ?? "image/png");
    const ext = contentType.split("/")[1]?.split("+")[0] || "png";
    const safeKind = ["logo", "badge", "sender", "asset"].includes(kind)
      ? kind
      : "asset";
    if (!contentType.startsWith("image/")) {
      throw new ApiError(400, "Only image uploads are allowed");
    }
    const key = `${safeKind}/${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}.${ext}`;
    const uploadUrl = await createPresignedUploadUrl(key, contentType);
    const publicUrl = `${s3PublicUrl}/${key}`;
    return NextResponse.json({ uploadUrl, key, publicUrl });
  } catch (err) {
    return errorResponse(err);
  }
}
