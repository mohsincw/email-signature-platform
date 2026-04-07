import { ClientSecretCredential } from "@azure/identity";

/**
 * Call any Exchange Online PowerShell cmdlet via the REST-based
 * "InvokeCommand" admin API. This is what
 *
 *     Connect-ExchangeOnline; Set-OrganizationConfig …
 *
 * does under the hood. Lets us drive Exchange config from a serverless
 * function without needing a real PowerShell host.
 *
 * Requires:
 *   - Azure AD app with the `Exchange.ManageAsApp` application
 *     permission from the "Office 365 Exchange Online" API (NOT
 *     Microsoft Graph), with admin consent granted.
 *   - The app's service principal assigned to the Entra "Exchange
 *     Administrator" directory role.
 */
export async function callExchangeCmdlet(
  cmdletName: string,
  parameters: Record<string, unknown> = {}
): Promise<any> {
  const tenantId = process.env.AZURE_TENANT_ID;
  const clientId = process.env.AZURE_CLIENT_ID;
  const clientSecret = process.env.AZURE_CLIENT_SECRET;

  if (!tenantId || !clientId || !clientSecret) {
    throw new Error(
      "AZURE_TENANT_ID / AZURE_CLIENT_ID / AZURE_CLIENT_SECRET must be set"
    );
  }

  const credential = new ClientSecretCredential(
    tenantId,
    clientId,
    clientSecret
  );
  const tokenResponse = await credential.getToken(
    "https://outlook.office365.com/.default"
  );
  if (!tokenResponse?.token) {
    throw new Error("Failed to acquire Exchange Online access token");
  }

  const url = `https://outlook.office365.com/adminapi/beta/${tenantId}/InvokeCommand`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${tokenResponse.token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      CmdletInput: {
        CmdletName: cmdletName,
        Parameters: parameters,
      },
    }),
  });

  const text = await res.text();
  let payload: any = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = text;
  }

  if (!res.ok) {
    const detail =
      typeof payload === "object"
        ? payload?.error?.message ||
          payload?.error?.details?.[0]?.message ||
          JSON.stringify(payload)
        : payload || res.statusText;
    const error: any = new Error(
      `Exchange cmdlet ${cmdletName} failed (${res.status}): ${detail}`
    );
    error.status = res.status;
    error.body = payload;
    throw error;
  }

  return payload;
}
