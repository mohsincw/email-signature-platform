import { prisma } from "./prisma";
import { getGraphClient, parseGraphError } from "./graph";
import { renderSignaturePlain } from "@esp/signature-renderer";
import { buildPngSignatureHtml } from "./signature-html";
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

  const signatureHtml = buildPngSignatureHtml(
    sender.id,
    settings?.disclaimer ?? ""
  );

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

/**
 * Remove (or disable) a signature from a user's M365 mailbox.
 *
 * mode = "disable" → sets signatureSettings.isEnabled = false, leaves
 *   the html/text in place so re-enabling restores instantly.
 * mode = "clear"   → also blanks out the html/text body. Used when a
 *   sender is being deleted from the platform.
 *
 * If the user has been removed from M365 (Graph 404) we still treat
 * it as success — there's nothing to clear, the side effect is
 * already what the caller wanted.
 */
export async function undeploySignature(
  senderId: string,
  mode: "disable" | "clear",
  adminUserId?: string
): Promise<DeploymentResultDto> {
  const graph = getGraphClient();
  const sender = await prisma.sender.findUnique({ where: { id: senderId } });
  if (!sender) throw new ApiError(400, `Sender ${senderId} not found`);

  // No Graph configured → silently succeed so the local
  // disable/delete still proceeds.
  if (!graph) {
    return {
      senderId: sender.id,
      senderEmail: sender.email,
      senderName: sender.name,
      success: true,
      deployedAt: new Date().toISOString(),
    };
  }

  const patch: any = {
    signatureSettings: {
      isEnabled: false,
      useForNewMessages: false,
      useForRepliesOrForwards: false,
    },
  };
  if (mode === "clear") {
    patch.signatureSettings.defaultSignature = { html: "", text: "" };
  }

  try {
    await graph
      .api(`/users/${sender.email}/mailboxSettings`)
      .version("beta")
      .header("Prefer", "outlook.allow-unsafe-html")
      .patch(patch);

    await prisma.deploymentLog.create({
      data: {
        senderId: sender.id,
        target: "outlook",
        status: mode === "clear" ? "cleared" : "disabled",
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
    // User no longer exists in M365 → there's nothing to clear, count as success
    if (err?.statusCode === 404) {
      return {
        senderId: sender.id,
        senderEmail: sender.email,
        senderName: sender.name,
        success: true,
        deployedAt: new Date().toISOString(),
      };
    }
    const errorMsg = parseGraphError(err);
    await prisma.deploymentLog.create({
      data: {
        senderId: sender.id,
        target: "outlook",
        status: "failed",
        error: `undeploy: ${errorMsg}`,
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
