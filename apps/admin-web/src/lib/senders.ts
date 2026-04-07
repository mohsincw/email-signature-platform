import type { Sender, DeploymentLog } from "@esp/database";
import type { SenderDto } from "@esp/shared-types";
import { s3PublicUrl } from "./s3";

type SenderWithDeployments = Sender & { deployments?: DeploymentLog[] };

export function senderToDto(sender: SenderWithDeployments): SenderDto {
  const lastDeployment = sender.deployments?.[0];
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
    lastDeployedAt: lastDeployment ? lastDeployment.deployedAt.toISOString() : null,
    lastDeployedStatus: lastDeployment ? lastDeployment.status : null,
  };
}
