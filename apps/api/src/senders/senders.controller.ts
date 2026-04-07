import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  BadRequestException,
} from "@nestjs/common";
import { SendersService } from "./senders.service";
import { CreateSenderDto, UpdateSenderDto } from "./senders.dto";
import { PrismaClient } from "@esp/database";
import { renderSignatureHtml } from "@esp/signature-renderer";
import { Public } from "../auth/public.decorator";
import * as nodemailer from "nodemailer";

@Controller("senders")
export class SendersController {
  constructor(
    private readonly sendersService: SendersService,
    private readonly prisma: PrismaClient
  ) {}

  @Get()
  findAll() {
    return this.sendersService.findAll();
  }

  @Public()
  @Get("lookup")
  findByEmail(@Query("email") email: string) {
    return this.sendersService.findByEmail(email);
  }

  @Get(":id")
  findById(@Param("id") id: string) {
    return this.sendersService.findById(id);
  }

  @Post()
  create(@Body() dto: CreateSenderDto) {
    return this.sendersService.create(dto);
  }

  @Put(":id")
  update(@Param("id") id: string, @Body() dto: UpdateSenderDto) {
    return this.sendersService.update(id, dto);
  }

  @Delete(":id")
  delete(@Param("id") id: string) {
    return this.sendersService.delete(id);
  }

  @Post(":id/upload-url")
  getUploadUrl(@Param("id") id: string) {
    return this.sendersService.getUploadUrl(id);
  }

  @Get(":id/preview")
  async getPreview(@Param("id") id: string) {
    const sender = await this.sendersService.findById(id);
    const settings = await this.prisma.globalSettings.findUnique({
      where: { id: "singleton" },
    });

    const html = renderSignatureHtml({
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

    return { html };
  }

  /**
   * Render a signature from arbitrary input (no DB lookup needed).
   * Used by the quick-generate page for instant previews.
   */
  @Post("render")
  async renderSignature(
    @Body()
    body: {
      name: string;
      title?: string;
      phone?: string;
      phone2?: string;
    }
  ) {
    const settings = await this.prisma.globalSettings.findUnique({
      where: { id: "singleton" },
    });

    const html = renderSignatureHtml({
      senderName: body.name,
      senderTitle: body.title ?? null,
      senderPhone: body.phone ?? null,
      senderPhone2: body.phone2 ?? null,
      addressLine1: settings?.addressLine1 ?? "",
      addressLine2: settings?.addressLine2 ?? "",
      website: settings?.website ?? "",
      logoUrl: settings?.logoUrl ?? "",
      badgeUrl: settings?.badgeUrl ?? "",
    });

    return { html };
  }

  /**
   * Send a test email with the rendered signature to verify it
   * works in real email clients (Outlook, Gmail, Apple Mail, etc).
   */
  @Post(":id/send-test")
  async sendTestEmail(
    @Param("id") id: string,
    @Body() body: { recipientEmail: string }
  ) {
    if (!body.recipientEmail) {
      throw new BadRequestException("recipientEmail is required");
    }

    const sender = await this.sendersService.findById(id);
    const settings = await this.prisma.globalSettings.findUnique({
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

    // Use environment-configured SMTP, or fall back to M365 SMTP relay
    const smtpHost = process.env.SMTP_HOST ?? "smtp.office365.com";
    const smtpPort = parseInt(process.env.SMTP_PORT ?? "587", 10);
    const smtpUser = process.env.SMTP_USER ?? "";
    const smtpPass = process.env.SMTP_PASS ?? "";

    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: smtpUser
        ? { user: smtpUser, pass: smtpPass }
        : undefined,
    } as nodemailer.TransportOptions);

    try {
      await transporter.sendMail({
        from: smtpUser || `"Signature Test" <noreply@chaiiwala.co.uk>`,
        to: body.recipientEmail,
        subject: `[TEST] Email Signature — ${sender.name}`,
        html: emailBody,
      });

      return { success: true, message: `Test email sent to ${body.recipientEmail}` };
    } catch (err: any) {
      return {
        success: false,
        message: `Failed to send: ${err.message}. Check SMTP_HOST, SMTP_USER, and SMTP_PASS env vars.`,
      };
    }
  }
}
