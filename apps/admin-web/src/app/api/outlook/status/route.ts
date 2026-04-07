import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getGraphClient } from "@/lib/graph";
import { errorResponse } from "@/lib/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    requireAuth(req);
    const graph = getGraphClient();
    const tenantId = process.env.AZURE_TENANT_ID;
    return NextResponse.json({
      configured: graph !== null,
      tenantId: tenantId ? tenantId.substring(0, 8) + "..." : undefined,
    });
  } catch (err) {
    return errorResponse(err);
  }
}
