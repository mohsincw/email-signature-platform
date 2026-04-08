import { PrismaClient } from "@prisma/client";
import { logger } from "./logger";

const prisma = new PrismaClient();

export interface SenderData {
  sender: {
    id: string;
    email: string;
    name: string;
    title: string | null;
    phone: string | null;
    phone2: string | null;
  };
  settings: {
    addressLine1: string;
    addressLine2: string;
    website: string;
    logoUrl: string;
    badgeUrl: string;
    disclaimer: string;
  };
}

/**
 * In-memory cache so a burst of emails from the same sender doesn't
 * hammer the DB. TTL is short because admins editing details on the
 * admin-web UI should see changes reflected within a minute.
 *
 * We only cache POSITIVE hits. Caching null would mean that disabling
 * a sender and re-enabling them within the TTL leaves the droplet
 * serving the stale null, so re-enabled senders' emails go out with
 * no signature until the entry expires. Negative lookups are cheap
 * (single indexed unique query on `email`) so skipping the cache for
 * them is fine — and it also stops random SMTP probes from filling
 * the cache with junk entries.
 */
interface CacheEntry {
  data: SenderData;
  expiresAt: number;
}
const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 60_000; // 1 minute

export async function lookupSender(
  rawEmail: string
): Promise<SenderData | null> {
  const email = rawEmail.toLowerCase().trim();
  const now = Date.now();

  const cached = cache.get(email);
  if (cached && cached.expiresAt > now) {
    return cached.data;
  }

  try {
    const sender = await prisma.sender.findUnique({
      where: { email },
    });
    if (!sender || !sender.enabled) {
      // Drop any stale positive entry for this email so a subsequent
      // re-enable (which skips the cache on the negative path) picks
      // up fresh data on the next email.
      cache.delete(email);
      return null;
    }

    const settings = await prisma.globalSettings.findUnique({
      where: { id: "singleton" },
    });

    const data: SenderData = {
      sender: {
        id: sender.id,
        email: sender.email,
        name: sender.name,
        title: sender.title,
        phone: sender.phone,
        phone2: sender.phone2,
      },
      settings: {
        addressLine1: settings?.addressLine1 ?? "",
        addressLine2: settings?.addressLine2 ?? "",
        website: settings?.website ?? "",
        logoUrl: settings?.logoUrl ?? "",
        badgeUrl: settings?.badgeUrl ?? "",
        disclaimer: settings?.disclaimer ?? "",
      },
    };
    cache.set(email, { data, expiresAt: now + CACHE_TTL_MS });
    return data;
  } catch (err) {
    logger.error({ err, email }, "Sender lookup failed");
    return null;
  }
}

/**
 * Clear the cache — useful after tests or when the admin UI pushes
 * an update we want to see immediately.
 */
export function clearSenderCache(): void {
  cache.clear();
}

export async function disconnectPrisma(): Promise<void> {
  await prisma.$disconnect();
}
