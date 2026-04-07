import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { senderToDto } from "@/lib/senders";
import { undeploySignature } from "@/lib/outlook";
import { ApiError, errorResponse } from "@/lib/errors";

export const maxDuration = 60;

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Ctx) {
  try {
    requireAuth(req);
    const { id } = await params;
    const sender = await prisma.sender.findUnique({
      where: { id },
      include: {
        deployments: { orderBy: { deployedAt: "desc" }, take: 1 },
      },
    });
    if (!sender) throw new ApiError(404, "Sender not found");
    return NextResponse.json(senderToDto(sender));
  } catch (err) {
    return errorResponse(err);
  }
}

export async function PUT(req: NextRequest, { params }: Ctx) {
  try {
    const auth = requireAuth(req);
    const { id } = await params;
    const body = await req.json();
    const existing = await prisma.sender.findUnique({ where: { id } });
    if (!existing) throw new ApiError(404, "Sender not found");

    // If we're disabling a previously-enabled sender, also turn off
    // their signature in M365 so it stops appearing on outgoing email.
    const isDisablingNow =
      body.enabled === false && existing.enabled === true;
    if (isDisablingNow) {
      try {
        await undeploySignature(id, "disable", auth.sub);
      } catch (err) {
        console.warn("[senders.PUT] undeploy on disable failed:", err);
        // continue — local disable still proceeds
      }
    }

    // Brand rule: names and job titles are always lowercase.
    const sender = await prisma.sender.update({
      where: { id },
      data: {
        email: body.email ? String(body.email).toLowerCase().trim() : undefined,
        name: body.name ? String(body.name).toLowerCase().trim() : undefined,
        title:
          body.title !== undefined
            ? body.title
              ? String(body.title).toLowerCase().trim()
              : null
            : undefined,
        phone: body.phone ?? undefined,
        phone2: body.phone2 ?? undefined,
        enabled: body.enabled ?? undefined,
        imageKey: body.imageKey ?? undefined,
      },
      include: {
        deployments: { orderBy: { deployedAt: "desc" }, take: 1 },
      },
    });
    return NextResponse.json(senderToDto(sender));
  } catch (err) {
    return errorResponse(err);
  }
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  try {
    const auth = requireAuth(req);
    const { id } = await params;
    const existing = await prisma.sender.findUnique({ where: { id } });
    if (!existing) throw new ApiError(404, "Sender not found");

    // Clear the signature from their M365 mailbox before removing the
    // local row. Failures here don't block the local delete — log a
    // warning so the operator can manually clean up if needed.
    try {
      await undeploySignature(id, "clear", auth.sub);
    } catch (err) {
      console.warn("[senders.DELETE] undeploy on delete failed:", err);
    }

    await prisma.sender.delete({ where: { id } });
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    return errorResponse(err);
  }
}
