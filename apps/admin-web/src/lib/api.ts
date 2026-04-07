import type {
  SenderDto,
  CreateSenderDto,
  UpdateSenderDto,
  GlobalSettingsDto,
} from "@esp/shared-types";

const API_BASE = "/api";

function getAuthHeader(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const token = localStorage.getItem("esp_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeader(),
      ...options?.headers,
    },
  });
  if (res.status === 401 && typeof window !== "undefined") {
    localStorage.removeItem("esp_token");
    localStorage.removeItem("esp_user");
    window.location.href = "/login";
    throw new Error("Session expired");
  }
  if (!res.ok) {
    throw new Error(`API error: ${res.status} ${res.statusText}`);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : (undefined as T);
}

export const api = {
  senders: {
    list: () => apiFetch<SenderDto[]>("/senders"),
    get: (id: string) => apiFetch<SenderDto>(`/senders/${id}`),
    create: (data: CreateSenderDto) =>
      apiFetch<SenderDto>("/senders", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    update: (id: string, data: UpdateSenderDto) =>
      apiFetch<SenderDto>(`/senders/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    delete: (id: string) =>
      apiFetch<void>(`/senders/${id}`, { method: "DELETE" }),
    getUploadUrl: (id: string) =>
      apiFetch<{ uploadUrl: string; key: string }>(
        `/senders/${id}/upload-url`,
        { method: "POST" }
      ),
    getPreview: (id: string) =>
      apiFetch<{ html: string }>(`/senders/${id}/preview`),
    renderSignature: (data: {
      name: string;
      title?: string;
      phone?: string;
      phone2?: string;
    }) =>
      apiFetch<{ html: string }>("/senders/render", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    sendTestEmail: (id: string, recipientEmail: string) =>
      apiFetch<{ success: boolean; message: string }>(
        `/senders/${id}/send-test`,
        {
          method: "POST",
          body: JSON.stringify({ recipientEmail }),
        }
      ),
  },
  outlook: {
    getStatus: () =>
      apiFetch<{ configured: boolean; tenantId?: string }>("/outlook/status"),
    deploy: (senderIds: string[]) =>
      apiFetch<
        {
          senderId: string;
          senderEmail: string;
          senderName: string;
          success: boolean;
          error?: string;
          deployedAt: string;
        }[]
      >("/outlook/deploy", {
        method: "POST",
        body: JSON.stringify({ senderIds }),
      }),
    getHistory: (senderId: string) =>
      apiFetch<
        {
          id: string;
          senderId: string;
          target: string;
          status: string;
          error: string | null;
          deployedAt: string;
        }[]
      >(`/outlook/history/${senderId}`),
  },
  settings: {
    get: () => apiFetch<GlobalSettingsDto>("/settings"),
    update: (data: GlobalSettingsDto) =>
      apiFetch<GlobalSettingsDto>("/settings", {
        method: "PUT",
        body: JSON.stringify(data),
      }),
  },
  uploads: {
    presign: (kind: "logo" | "badge" | "sender" | "asset", contentType: string) =>
      apiFetch<{ uploadUrl: string; key: string; publicUrl: string }>(
        "/upload-url",
        {
          method: "POST",
          body: JSON.stringify({ kind, contentType }),
        }
      ),
  },
  admin: {
    enableRoamingSignatures: () =>
      apiFetch<{
        success: boolean;
        message: string;
        previousValue: boolean | null;
        currentValue: boolean | null;
      }>("/admin/enable-roaming-signatures", { method: "POST" }),
  },
};

/**
 * Upload a File or Blob via a presigned URL and return its public URL.
 * Used by paste/drop image zones to push directly to Supabase Storage.
 */
export async function uploadImage(
  file: File | Blob,
  kind: "logo" | "badge" | "sender" | "asset" = "asset"
): Promise<string> {
  const contentType = (file as File).type || "image/png";
  const { uploadUrl, publicUrl } = await api.uploads.presign(kind, contentType);
  const res = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: file,
  });
  if (!res.ok) {
    throw new Error(`Upload failed: ${res.status} ${res.statusText}`);
  }
  return publicUrl;
}
