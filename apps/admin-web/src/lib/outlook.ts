import { prisma } from "./prisma";
import { getGraphClient, parseGraphError } from "./graph";
import { renderSignatureHtml, renderSignaturePlain } from "@esp/signature-renderer";
import type { DeploymentResultDto } from "@esp/shared-types";
import { ApiError } from "./errors";

export async function deploySignature(
  senderId: string,
  adminUserId?: string
): Promise<DeploymentResultDto> {
  const graph = getGraphClient();
  if (!graph) {
    throw new ApiError(
      400,
      "Microsoft Graph API is not configured. Set AZURE_TENANT_ID, AZURE_CLIENT_ID, and AZURE_CLIENT_SECRET."
    );
  }

  const sender = await prisma.sender.findUnique({ where: { id: senderId } });
  if (!sender) throw new ApiError(400, `Sender ${senderId} not found`);

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
    try {
      await graph.api(`/users/${sender.email}`).version("v1.0").get();
    } catch (lookupErr: any) {
      if (lookupErr?.statusCode === 404) {
        throw new Error(
          "User not found in Microsoft 365 directory. Check the email address."
        );
      }
      if (lookupErr?.statusCode === 403) {
        throw new Error(
          "Insufficient permissions. Add User.Read.All application permission in Azure AD and grant admin consent."
        );
      }
      throw lookupErr;
    }

    try {
      await graph
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
      if (
        msg.includes("signatureSettings") ||
        msg.includes("does not exist on type")
      ) {
        throw new Error(
          "Your M365 tenant doesn't support the Graph API signature endpoint yet. To enable it: go to Exchange Admin Center \u2192 Settings \u2192 Mail flow \u2192 enable 'Roaming signatures'. Alternatively, use the 'Copy Signature HTML' button on the Generate page to copy and paste manually."
        );
      }
      throw sigErr;
    }

    await prisma.deploymentLog.create({
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
    const errorMsg = parseGraphError(err);
    await prisma.deploymentLog.create({
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
