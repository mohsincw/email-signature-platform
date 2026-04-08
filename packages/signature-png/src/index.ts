import satori from "satori";
import { Resvg } from "@resvg/resvg-js";
import { promises as fs } from "fs";

// Display size at which the signature appears in the recipient's email.
// Satori renders at 2x this for retina sharpness.
export const SIG_DISPLAY_WIDTH = 314;
export const SIG_DISPLAY_HEIGHT = 154;
const RENDER_SCALE = 2;
const CANVAS_W = SIG_DISPLAY_WIDTH * RENDER_SCALE;
const CANVAS_H = SIG_DISPLAY_HEIGHT * RENDER_SCALE;

let cachedBlackFont: ArrayBuffer | null = null;
let cachedRegularFont: ArrayBuffer | null = null;

async function readFontFile(fontPath: string): Promise<ArrayBuffer> {
  const buf = await fs.readFile(fontPath);
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
}

/**
 * Load both Myriad Pro weights the renderer uses. Black is the heavy
 * weight used for the name, phone and website. Regular is used for the
 * job title and the address lines so they don't compete visually with
 * the name. Callers from different environments (Next.js on Vercel,
 * plain Node in Docker) pass their own paths since __dirname resolution
 * differs between bundled and unbundled code. Results are cached for
 * the lifetime of the process.
 */
export async function loadFonts(paths: {
  black: string;
  regular: string;
}): Promise<void> {
  if (!cachedBlackFont) cachedBlackFont = await readFontFile(paths.black);
  if (!cachedRegularFont) cachedRegularFont = await readFontFile(paths.regular);
}

/**
 * Back-compat shim for callers that only pass the black font path. The
 * regular font is assumed to live next to it with the name
 * `myriad-pro-regular.otf`.
 */
export async function loadFontFromPath(
  blackFontPath: string
): Promise<void> {
  const regularPath = blackFontPath.replace(
    /myriad-pro-black\.otf$/i,
    "myriad-pro-regular.otf"
  );
  await loadFonts({ black: blackFontPath, regular: regularPath });
}

/**
 * Supply pre-loaded font data directly. Used by the admin-web serverless
 * function when the font is bundled into the output.
 */
export function setFontData(data: { black: ArrayBuffer; regular: ArrayBuffer }): void {
  cachedBlackFont = data.black;
  cachedRegularFont = data.regular;
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
  if (!cachedBlackFont || !cachedRegularFont) {
    throw new Error(
      "[signature-png] fonts not loaded — call loadFonts() or loadFontFromPath() before renderSignaturePng()"
    );
  }

  const [logoDataUrl, badgeDataUrl] = await Promise.all([
    fetchAsDataUrl(input.logoUrl),
    fetchAsDataUrl(input.badgeUrl),
  ]);

  const FONT = "Myriad Pro";
  const BLACK = "#000000";
  // Layout dimensions — sized to fill the 628x308 (2x of 314x154)
  // Satori canvas. Bigger than the original tiny sizing so the content
  // doesn't float in empty space.
  const LOGO_W = 150;
  const BADGE_W = 118;

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
        style: { width: BADGE_W, marginTop: 12, objectFit: "contain" },
      },
    });
  }

  const rightChildren: any[] = [];
  rightChildren.push({
    type: "div",
    props: {
      style: {
        fontSize: 30,
        fontWeight: 900,
        color: BLACK,
        lineHeight: 1.1,
        marginBottom: 2,
      },
      children: displayName,
    },
  });
  if (displayTitle) {
    rightChildren.push({
      type: "div",
      props: {
        style: {
          fontSize: 12,
          fontWeight: 400,
          color: BLACK,
          letterSpacing: 1.5,
          marginBottom: 12,
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
          fontSize: 24,
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
          fontSize: 24,
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
    props: { style: { height: 10 } },
  });
  if (input.addressLine1) {
    rightChildren.push({
      type: "div",
      props: {
        style: {
          fontSize: 10,
          fontWeight: 400,
          color: BLACK,
          textTransform: "uppercase",
          letterSpacing: 1.4,
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
          fontSize: 10,
          fontWeight: 400,
          color: BLACK,
          textTransform: "uppercase",
          letterSpacing: 1.4,
          lineHeight: 1.5,
        },
        children: input.addressLine2,
      },
    });
  }
  if (input.website) {
    rightChildren.push({
      type: "div",
      props: { style: { height: 8 } },
    });
    const display = input.website.replace(/^https?:\/\//, "");
    rightChildren.push({
      type: "div",
      props: {
        style: {
          fontSize: 15,
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
        padding: 16,
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
              paddingRight: 18,
              borderRight: "1px solid #000000",
              minWidth: 170,
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
              paddingLeft: 18,
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
        data: cachedBlackFont,
        weight: 900,
        style: "normal",
      },
      {
        name: FONT,
        data: cachedRegularFont,
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
