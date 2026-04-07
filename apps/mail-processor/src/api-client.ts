import type { SenderDto, GlobalSettingsDto } from "@esp/shared-types";
import { logger } from "./logger";

const API_BASE_URL = process.env.API_BASE_URL ?? "http://localhost:3001";

interface SenderLookupResult {
  sender: SenderDto;
  settings: GlobalSettingsDto;
}

export async function lookupSender(
  email: string
): Promise<SenderLookupResult | null> {
  try {
    const senderRes = await fetch(
      `${API_BASE_URL}/senders/lookup?email=${encodeURIComponent(email)}`
    );

    if (!senderRes.ok) {
      logger.warn({ email, status: senderRes.status }, "Sender lookup failed");
      return null;
    }

    const sender: SenderDto | null = await senderRes.json();
    if (!sender) return null;

    const settingsRes = await fetch(`${API_BASE_URL}/settings`);
    if (!settingsRes.ok) {
      logger.warn("Settings fetch failed");
      return null;
    }

    const settings: GlobalSettingsDto = await settingsRes.json();
    return { sender, settings };
  } catch (err) {
    logger.error({ err, email }, "API lookup error");
    return null;
  }
}
