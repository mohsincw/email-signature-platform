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
 * In-memory cache so a single burst of emails from the same sender
 * doesn't hammer the DB. TTL is short because admins editing details
 * on the admin-web UI should see changes reflected within a minute.
 */
interface CacheEntry {
  data: SenderData | null;
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
      cache.set(email, { data: null, expiresAt: now + CACHE_TTL_MS });
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
