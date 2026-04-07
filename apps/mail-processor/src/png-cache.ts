import {
  renderSignaturePng,
  loadFontFromPath,
  type PngInput,
} from "@esp/signature-png";
import { config } from "./config";
import { logger } from "./logger";

let fontLoaded = false;

async function ensureFontLoaded(): Promise<void> {
  if (fontLoaded) return;
  await loadFontFromPath(config.fontPath);
  fontLoaded = true;
  logger.info({ fontPath: config.fontPath }, "Signature font loaded");
}

/**
 * Per-sender PNG cache so repeated emails from the same user hit a
 * hot buffer instead of re-rendering. Cache key includes a hash of
 * the input so any edit to the sender's details (via admin UI) forces
 * a re-render on the next email.
 */
interface CacheEntry {
  key: string;
  png: Buffer;
  expiresAt: number;
}
const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 5 * 60_000;
const MAX_ENTRIES = 200;

function keyFor(input: PngInput): string {
  return JSON.stringify([
    input.senderName,
    input.senderTitle,
    input.senderPhone,
    input.senderPhone2,
    input.addressLine1,
    input.addressLine2,
    input.website,
    input.logoUrl,
    input.badgeUrl,
  ]);
}

export async function renderSignaturePngCached(
  senderEmail: string,
  input: PngInput
): Promise<Buffer> {
  await ensureFontLoaded();

  const key = keyFor(input);
  const now = Date.now();
  const existing = cache.get(senderEmail);
  if (existing && existing.key === key && existing.expiresAt > now) {
    return existing.png;
  }

  const png = await renderSignaturePng(input);
  cache.set(senderEmail, { key, png, expiresAt: now + CACHE_TTL_MS });

  if (cache.size > MAX_ENTRIES) {
    // Evict the oldest entry (Maps preserve insertion order)
    const oldest = cache.keys().next().value;
    if (oldest) cache.delete(oldest);
  }

  return png;
}
