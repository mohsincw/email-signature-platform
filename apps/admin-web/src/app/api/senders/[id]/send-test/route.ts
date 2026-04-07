import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { renderSignatureHtml } from "@esp/signature-renderer";
import { createTransport, defaultFromAddress } from "@/lib/mailer";
import { ApiError, errorResponse } from "@/lib/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Ctx) {
  try {
    requireAuth(req);
    const { id } = await params;
    const body = await req.json();
    if (!body?.recipientEmail) {
      throw new ApiError(400, "recipientEmail is required");
    }

    const sender = await prisma.sender.findUnique({ where: { id } });
    if (!sender) throw new ApiError(404, "Sender not found");

    const settings = await prisma.globalSettings.findUnique({
      where: { id: "singleton" },
    });

    const signatureHtml = renderSignatureHtml({
      senderName: sender.name,
      senderTitle: sender.title,
      senderPhone: sender.phone,
      senderPhone2: sender.phone2,
      addressLine1: settings?.addressLine1 ?? "",
      addressLine2: settings?.addressLine2 ?? "",
      website: settings?.website ?? "",
      logoUrl: settings?.logoUrl ?? "",
      badgeUrl: settings?.badgeUrl ?? "",
    });

    const emailBody = `
      <html>
        <body style="font-family: Arial, sans-serif; font-size: 14px; color: #333;">
          <p>Hi,</p>
          <p>This is a test email to verify the email signature renders correctly in your mail client.</p>
          <p>If the signature below looks correct with the logo, badge, and contact details properly laid out, the platform is working as expected.</p>
          <p>Thanks,</p>
          ${signatureHtml}
        </body>
      </html>
    `;

    try {
      const transporter = createTransport();
      await transporter.sendMail({
        from: defaultFromAddress(),
        to: body.recipientEmail,
        subject: `[TEST] Email Signature \u2014 ${sender.name}`,
        html: emailBody,
      });
      return NextResponse.json({
        success: true,
        message: `Test email sent to ${body.recipientEmail}`,
      });
    } catch (err: any) {
      return NextResponse.json({
        success: false,
        message: `Failed to send: ${err.message}. Check SMTP_HOST, SMTP_USER, and SMTP_PASS env vars.`,
      });
    }
  } catch (err) {
    return errorResponse(err);
  }
}
