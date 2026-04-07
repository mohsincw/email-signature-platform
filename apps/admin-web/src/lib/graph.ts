import { ClientSecretCredential } from "@azure/identity";
import { Client } from "@microsoft/microsoft-graph-client";
import { TokenCredentialAuthenticationProvider } from "@microsoft/microsoft-graph-client/authProviders/azureTokenCredentials/index.js";

let cachedClient: Client | null = null;
let initialized = false;

export function getGraphClient(): Client | null {
  if (initialized) return cachedClient;
  initialized = true;

  const tenantId = process.env.AZURE_TENANT_ID;
  const clientId = process.env.AZURE_CLIENT_ID;
  const clientSecret = process.env.AZURE_CLIENT_SECRET;

  if (!tenantId || !clientId || !clientSecret) {
    console.warn(
      "\u26a0 Azure AD credentials not configured. Outlook deployment will be unavailable."
    );
    cachedClient = null;
    return null;
  }

  const credential = new ClientSecretCredential(tenantId, clientId, clientSecret);
  const authProvider = new TokenCredentialAuthenticationProvider(credential, {
    scopes: ["https://graph.microsoft.com/.default"],
  });
  cachedClient = Client.initWithMiddleware({ authProvider });
  return cachedClient;
}

export function parseGraphError(err: any): string {
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
