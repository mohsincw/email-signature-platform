export interface SenderDto {
  id: string;
  email: string;
  name: string;
  title: string | null;
  phone: string | null;
  phone2: string | null;
  enabled: boolean;
  imageKey: string | null;
  imageUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSenderDto {
  email: string;
  name: string;
  title?: string;
  phone?: string;
  phone2?: string;
}

export interface UpdateSenderDto {
  email?: string;
  name?: string;
  title?: string;
  phone?: string;
  phone2?: string;
  enabled?: boolean;
  imageKey?: string;
}

export interface GlobalSettingsDto {
  addressLine1: string;
  addressLine2: string;
  website: string;
  logoUrl: string;
  badgeUrl: string;
}

export interface SignatureRenderInput {
  senderName: string;
  senderTitle: string | null;
  senderPhone: string | null;
  senderPhone2: string | null;
  addressLine1: string;
  addressLine2: string;
  website: string;
  logoUrl: string;
  badgeUrl: string;
}

export interface UploadUrlResponse {
  uploadUrl: string;
  key: string;
}

export const SIGNATURE_HEADER = "X-Org-Signature-Applied";

export interface DeployToOutlookRequest {
  senderIds: string[];
}

export interface DeploymentResultDto {
  senderId: string;
  senderEmail: string;
  senderName: string;
  success: boolean;
  error?: string;
  deployedAt: string;
}

export interface DeploymentLogDto {
  id: string;
  senderId: string;
  target: string;
  status: string;
  error: string | null;
  deployedAt: string;
  deployedBy: string | null;
}

export interface OutlookConfigStatusDto {
  configured: boolean;
  tenantId?: string;
}
