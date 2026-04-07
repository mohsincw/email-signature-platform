import { Injectable, Inject, BadRequestException } from "@nestjs/common";
import { PrismaClient } from "@esp/database";
import { ClientSecretCredential } from "@azure/identity";
import { renderSignatureHtml, renderSignaturePlain } from "@esp/signature-renderer";
import type {
  DeploymentResultDto,
  DeploymentLogDto,
  OutlookConfigStatusDto,
} from "@esp/shared-types";
import { GRAPH_CLIENT } from "./graph-client.provider";

@Injectable()
export class OutlookService {
  constructor(
    @Inject(GRAPH_CLIENT) private readonly graphClient: any | null,
    private readonly prisma: PrismaClient
  ) {}

  getConfigStatus(): OutlookConfigStatusDto {
    const tenantId = process.env.AZURE_TENANT_ID;
    return {
      configured: this.graphClient !== null,
      tenantId: tenantId ? tenantId.substring(0, 8) + "..." : undefined,
    };
  }

  async deploySignature(
    senderId: string,
    adminUserId?: string
  ): Promise<DeploymentResultDto> {
    if (!this.graphClient) {
      throw new BadRequestException(
        "Microsoft Graph API is not configured. Set AZURE_TENANT_ID, AZURE_CLIENT_ID, and AZURE_CLIENT_SECRET."
      );
    }

    const sender = await this.prisma.sender.findUnique({
      where: { id: senderId },
    });
    if (!sender) {
      throw new BadRequestException(`Sender ${senderId} not found`);
    }

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

    const signaturePlain = renderSignaturePlain(
      sender.name,
      sender.title,
      sender.phone,
      sender.phone2,
      settings?.addressLine1 ?? "",
      settings?.addressLine2 ?? "",
      settings?.website ?? ""
    );

    try {
      // Step 1: Verify user exists in M365 via Graph SDK (uses cached token)
      try {
        await this.graphClient!.api(`/users/${sender.email}`).version("v1.0").get();
      } catch (lookupErr: any) {
        if (lookupErr?.statusCode === 404) {
          throw new Error("User not found in Microsoft 365 directory. Check the email address.");
        }
        if (lookupErr?.statusCode === 403) {
          throw new Error("Insufficient permissions. Add User.Read.All application permission in Azure AD and grant admin consent.");
        }
        throw lookupErr;
      }

      // Step 2: Try setting signature via beta signatureSettings
      try {
        await this.graphClient!
          .api(`/users/${sender.email}/mailboxSettings`)
          .version("beta")
          .header("Prefer", "outlook.allow-unsafe-html")
          .patch({
            signatureSettings: {
              isEnabled: true,
              useForNewMessages: true,
              useForRepliesOrForwards: true,
              defaultSignature: {
                html: signatureHtml,
                text: signaturePlain,
              },
            },
          });
      } catch (sigErr: any) {
        const msg = sigErr?.body?.error?.message || sigErr?.message || "";
        if (msg.includes("signatureSettings") || msg.includes("does not exist on type")) {
          throw new Error(
            "Your M365 tenant doesn't support the Graph API signature endpoint yet. " +
            "To enable it: go to Exchange Admin Center → Settings → Mail flow → enable 'Roaming signatures'. " +
            "Alternatively, use the 'Copy Signature HTML' button on the Generate page to copy and paste manually."
          );
        }
        throw sigErr;
      }

      // Log success
      await this.prisma.deploymentLog.create({
        data: {
          senderId: sender.id,
          target: "outlook",
          status: "success",
          deployedBy: adminUserId,
        },
      });

      return {
        senderId: sender.id,
        senderEmail: sender.email,
        senderName: sender.name,
        success: true,
        deployedAt: new Date().toISOString(),
      };
    } catch (err: any) {
      console.error("Graph API error:", JSON.stringify(err, Object.getOwnPropertyNames(err), 2));
      const errorMsg = this.parseGraphError(err);

      // Log failure
      await this.prisma.deploymentLog.create({
        data: {
          senderId: sender.id,
          target: "outlook",
          status: "failed",
          error: errorMsg,
          deployedBy: adminUserId,
        },
      });

      return {
        senderId: sender.id,
        senderEmail: sender.email,
        senderName: sender.name,
        success: false,
        error: errorMsg,
        deployedAt: new Date().toISOString(),
      };
    }
  }

  async deployBulk(
    senderIds: string[],
    adminUserId?: string
  ): Promise<DeploymentResultDto[]> {
    const results: DeploymentResultDto[] = [];
    for (const id of senderIds) {
      const result = await this.deploySignature(id, adminUserId);
      results.push(result);
      // Small delay to avoid Graph API throttling
      await new Promise((r) => setTimeout(r, 200));
    }
    return results;
  }

  async getDeploymentHistory(senderId: string): Promise<DeploymentLogDto[]> {
    const logs = await this.prisma.deploymentLog.findMany({
      where: { senderId },
      orderBy: { deployedAt: "desc" },
      take: 10,
    });
    return logs.map((l) => ({
      id: l.id,
      senderId: l.senderId,
      target: l.target,
      status: l.status,
      error: l.error,
      deployedAt: l.deployedAt.toISOString(),
      deployedBy: l.deployedBy,
    }));
  }

  private async getAccessToken(): Promise<string> {
    const tenantId = process.env.AZURE_TENANT_ID!;
    const clientId = process.env.AZURE_CLIENT_ID!;
    const clientSecret = process.env.AZURE_CLIENT_SECRET!;
    const credential = new ClientSecretCredential(tenantId, clientId, clientSecret);
    const token = await credential.getToken("https://graph.microsoft.com/.default");
    return token.token;
  }

  private parseGraphError(err: any): string {
    const code = err?.code || err?.statusCode;
    const message = err?.body?.error?.message || err?.message || "Unknown error";

    if (code === 404 || message.includes("does not exist")) {
      return "User not found in Microsoft 365 directory. Check the email address.";
    }
    if (code === 403) {
      return "Insufficient permissions. Ensure MailboxSettings.ReadWrite application permission is granted with admin consent.";
    }
    if (code === 401) {
      return "Authentication failed. Check Azure AD credentials (tenant ID, client ID, client secret).";
    }
    if (code === 429) {
      return "Rate limited by Microsoft Graph API. Try again in a few minutes.";
    }
    return message;
  }
}
