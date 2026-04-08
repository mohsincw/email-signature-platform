import satori from "satori";
import { Resvg } from "@resvg/resvg-js";
import { promises as fs } from "fs";

// Display size at which the signature appears in the recipient's email.
// Satori renders at 2x this for retina sharpness.
export const SIG_DISPLAY_WIDTH = 540;
export const SIG_DISPLAY_HEIGHT = 265;
const RENDER_SCALE = 2;
const CANVAS_W = SIG_DISPLAY_WIDTH * RENDER_SCALE;
const CANVAS_H = SIG_DISPLAY_HEIGHT * RENDER_SCALE;

let cachedFont: ArrayBuffer | null = null;

/**
 * Load the Myriad Pro font from a path on disk. Callers from different
 * environments (Next.js on Vercel, plain Node in Docker) pass their own
 * path since __dirname resolution differs between bundled and unbundled
 * code. Result is cached for the lifetime of the process.
 */
export async function loadFontFromPath(
  fontPath: string
): Promise<ArrayBuffer> {
  if (cachedFont) return cachedFont;
  const buf = await fs.readFile(fontPath);
  cachedFont = buf.buffer.slice(
    buf.byteOffset,
    buf.byteOffset + buf.byteLength
  );
  return cachedFont;
}

/**
 * Supply pre-loaded font data directly. Used by the admin-web serverless
 * function when the font is bundled into the output.
 */
export function setFontData(data: ArrayBuffer): void {
  cachedFont = data;
}

/**
 * Pre-fetch a remote image and inline it as a base64 data URL. Satori
 * can technically fetch image src URLs itself but it's flaky — pre-
 * fetching server-side is bulletproof.
 */
async function fetchAsDataUrl(url: string): Promise<string | null> {
  if (!url) return null;
  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.warn(`[signature-png] image fetch failed ${res.status}: ${url}`);
      return null;
    }
    const buf = Buffer.from(await res.arrayBuffer());
    let contentType = res.headers.get("content-type") || "";
    if (!contentType.startsWith("image/")) {
      const ext = url.split(".").pop()?.toLowerCase().split("?")[0];
      contentType =
        ext === "jpg" || ext === "jpeg"
          ? "image/jpeg"
          : ext === "gif"
          ? "image/gif"
          : ext === "svg"
          ? "image/svg+xml"
          : "image/png";
    }
    return `data:${contentType};base64,${buf.toString("base64")}`;
  } catch (err) {
    console.warn(`[signature-png] image fetch threw: ${url}`, err);
    return null;
  }
}

export interface PngInput {
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

/**
 * Render the signature (logo + contact details) as a PNG buffer. The
 * disclaimer is NOT rendered into the image — it's expected to be
 * added as live HTML text below the image by the caller.
 *
 * Before calling this, the font must be loaded via either
 * loadFontFromPath() or setFontData(), otherwise you get an error.
 */
export async function renderSignaturePng(input: PngInput): Promise<Buffer> {
  if (!cachedFont) {
    throw new Error(
      "[signature-png] font not loaded — call loadFontFromPath() or setFontData() before renderSignaturePng()"
    );
  }

  const [logoDataUrl, badgeDataUrl] = await Promise.all([
    fetchAsDataUrl(input.logoUrl),
    fetchAsDataUrl(input.badgeUrl),
  ]);

  const FONT = "Myriad Pro";
  const BLACK = "#000000";
  // Layout dimensions — sized to fit the 1080x530 (2x of 540x265) Satori
  // canvas. Every value below was originally tuned for the 628x308
  // canvas, then scaled by ~1.72 (540/314) to match the new display size.
  const LOGO_W = 190;
  const BADGE_W = 158;

  // Brand rule: names and job titles are always lowercase regardless
  // of how they're stored. Satori doesn't support CSS text-transform,
  // so we normalise at the data layer.
  const displayName = (input.senderName ?? "").toLowerCase();
  const displayTitle = input.senderTitle ? input.senderTitle.toLowerCase() : null;

  const leftChildren: any[] = [];
  if (logoDataUrl) {
    leftChildren.push({
      type: "img",
      props: {
        src: logoDataUrl,
        width: LOGO_W,
        style: { width: LOGO_W, objectFit: "contain" },
      },
    });
  }
  if (badgeDataUrl) {
    leftChildren.push({
      type: "img",
      props: {
        src: badgeDataUrl,
        width: BADGE_W,
        style: { width: BADGE_W, marginTop: 17, objectFit: "contain" },
      },
    });
  }

  const rightChildren: any[] = [];
  rightChildren.push({
    type: "div",
    props: {
      style: {
        fontSize: 38,
        fontWeight: 900,
        color: BLACK,
        lineHeight: 1.1,
        marginBottom: 3,
      },
      children: displayName,
    },
  });
  if (displayTitle) {
    rightChildren.push({
      type: "div",
      props: {
        style: {
          fontSize: 15,
          fontWeight: 900,
          color: BLACK,
          letterSpacing: 1.9,
          marginBottom: 17,
        },
        children: displayTitle,
      },
    });
  }
  if (input.senderPhone) {
    rightChildren.push({
      type: "div",
      props: {
        style: {
          fontSize: 31,
          fontWeight: 900,
          color: BLACK,
          lineHeight: 1.15,
        },
        children: input.senderPhone,
      },
    });
  }
  if (input.senderPhone2) {
    rightChildren.push({
      type: "div",
      props: {
        style: {
          fontSize: 31,
          fontWeight: 900,
          color: BLACK,
          lineHeight: 1.15,
        },
        children: input.senderPhone2,
      },
    });
  }
  rightChildren.push({
    type: "div",
    props: { style: { height: 14 } },
  });
  if (input.addressLine1) {
    rightChildren.push({
      type: "div",
      props: {
        style: {
          fontSize: 12,
          fontWeight: 900,
          color: BLACK,
          textTransform: "uppercase",
          letterSpacing: 1.7,
          lineHeight: 1.5,
        },
        children: input.addressLine1,
      },
    });
  }
  if (input.addressLine2) {
    rightChildren.push({
      type: "div",
      props: {
        style: {
          fontSize: 12,
          fontWeight: 900,
          color: BLACK,
          textTransform: "uppercase",
          letterSpacing: 1.7,
          lineHeight: 1.5,
        },
        children: input.addressLine2,
      },
    });
  }
  if (input.website) {
    rightChildren.push({
      type: "div",
      props: { style: { height: 10 } },
    });
    const display = input.website.replace(/^https?:\/\//, "");
    rightChildren.push({
      type: "div",
      props: {
        style: {
          fontSize: 19,
          fontWeight: 900,
          color: BLACK,
          display: "flex",
        },
        children: display,
      },
    });
  }

  const tree = {
    type: "div",
    props: {
      style: {
        display: "flex",
        flexDirection: "row",
        alignItems: "stretch",
        background: "#ffffff",
        padding: 21,
        fontFamily: FONT,
      },
      children: [
        {
          type: "div",
          props: {
            style: {
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              alignItems: "center",
              paddingRight: 24,
              borderRight: "3px solid #000000",
              minWidth: 224,
            },
            children: leftChildren,
          },
        },
        {
          type: "div",
          props: {
            style: {
              display: "flex",
              flexDirection: "column",
              paddingLeft: 24,
              justifyContent: "center",
            },
            children: rightChildren,
          },
        },
      ],
    },
  };

  const svg = await satori(tree as any, {
    width: CANVAS_W,
    height: CANVAS_H,
    fonts: [
      {
        name: FONT,
        data: cachedFont,
        weight: 900,
        style: "normal",
      },
      {
        name: FONT,
        data: cachedFont,
        weight: 400,
        style: "normal",
      },
    ],
  });

  const resvg = new Resvg(svg, {
    fitTo: { mode: "width", value: SIG_DISPLAY_WIDTH * 2 },
  });
  const png = resvg.render().asPng();
  return Buffer.from(png);
}
