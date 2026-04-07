import type { Sender } from "@esp/database";
import type { SenderDto } from "@esp/shared-types";
import { s3PublicUrl } from "./s3";

export function senderToDto(sender: Sender): SenderDto {
  return {
    id: sender.id,
    email: sender.email,
    name: sender.name,
    title: sender.title,
    phone: sender.phone,
    phone2: sender.phone2,
    enabled: sender.enabled,
    imageKey: sender.imageKey,
    imageUrl: sender.imageKey ? `${s3PublicUrl}/${sender.imageKey}` : null,
    createdAt: sender.createdAt.toISOString(),
    updatedAt: sender.updatedAt.toISOString(),
  };
}
