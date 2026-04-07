import { type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { renderSignaturePng } from "@/lib/png-renderer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * Public endpoint hit by Outlook when rendering the email signature
 * image embedded by the server-side transport rule. The transport
 * rule embeds:
 *
 *   <img src="https://.../api/signature.png?email=%%UserPrincipalName%%" />
 *
 * Exchange Online substitutes %%UserPrincipalName%% with the sender's
 * UPN at message-send time, so each recipient receives a personalised
 * image URL. We look the sender up here and render their PNG.
 *
 * No auth — Outlook clients can't send credentials. The URL is the only
 * "secret" and it leaks the sender's name/title/phone, which are already
 * in every email they send anyway.
 */
export async function GET(req: NextRequest) {
  const email = (req.nextUrl.searchParams.get("email") || "").toLowerCase().trim();

  if (!email) {
    return placeholder("missing email");
  }

  const sender = await prisma.sender.findUnique({ where: { email } });

  // Unknown sender → return a 1x1 transparent pixel so the email still
  // renders without a broken image icon. We don't want a 404 because
  // some email clients show that visually.
  if (!sender || !sender.enabled) {
    return transparentPixel();
  }

  const settings = await prisma.globalSettings.findUnique({
    where: { id: "singleton" },
  });

  try {
    const png = await renderSignaturePng({
      senderName: sender.name,
      senderTitle: sender.title,
      senderPhone: sender.phone,
      senderPhone2: sender.phone2,
      addressLine1: settings?.addressLine1 ?? "",
      addressLine2: settings?.addressLine2 ?? "",
      website: settings?.website ?? "",
      logoUrl: settings?.logoUrl ?? "",
      badgeUrl: settings?.badgeUrl ?? "",
    });

    return new Response(new Uint8Array(png), {
      headers: {
        "Content-Type": "image/png",
        // Short cache so size/style tweaks propagate quickly. Bump to
        // a longer max-age once the rendering is locked in.
        "Cache-Control": "public, max-age=60, s-maxage=60",
      },
    });
  } catch (err) {
    console.error("[signature.png] render failed:", err);
    return transparentPixel();
  }
}

function placeholder(reason: string) {
  return new Response(`signature unavailable: ${reason}`, {
    status: 200,
    headers: { "Content-Type": "text/plain" },
  });
}

function transparentPixel() {
  // 1x1 transparent PNG as base64
  const b64 =
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkAAIAAAoAAv/lxKUAAAAASUVORK5CYII=";
  const buf = Buffer.from(b64, "base64");
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=60",
    },
  });
}
