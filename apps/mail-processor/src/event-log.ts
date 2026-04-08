import { PrismaClient } from "@prisma/client";
import { logger } from "./logger";

// Reuse a single Prisma client across event writes. The sender-lookup
// module instantiates its own; duplicating here is cheap but we keep
// it independent so a transient failure writing events can never
// break the hot signature path.
const prisma = new PrismaClient();

export type MailEventStatus =
  | "signed"
  | "passthrough"
  | "already_processed"
  | "error";

export interface RecordEventInput {
  senderEmail: string;
  senderName?: string | null;
  recipients: string[];
  status: MailEventStatus;
  reason?: string;
  errorMessage?: string;
  originalBytes?: number;
  rewrittenBytes?: number;
}

/**
 * Best-effort write of a MailEvent row so the admin-web Console page
 * can display a live activity feed. Errors are swallowed — recording
 * an event failing must never stop the message being relayed, that
 * would turn an observability feature into a reliability regression.
 */
export async function recordEvent(input: RecordEventInput): Promise<void> {
  try {
    await prisma.mailEvent.create({
      data: {
        senderEmail: input.senderEmail,
        senderName: input.senderName ?? null,
        recipients: input.recipients,
        status: input.status,
        reason: input.reason ?? null,
        errorMessage: input.errorMessage ?? null,
        originalBytes: input.originalBytes ?? null,
        rewrittenBytes: input.rewrittenBytes ?? null,
      },
    });
  } catch (err) {
    logger.warn({ err, input }, "Failed to record mail event (non-fatal)");
  }
}
