import satori from "satori";
import { Resvg } from "@resvg/resvg-js";
import path from "path";
import { promises as fs } from "fs";

let cachedFont: ArrayBuffer | null = null;

async function loadMyriadProFont(): Promise<ArrayBuffer> {
  if (cachedFont) return cachedFont;
  const fontPath = path.join(
    process.cwd(),
    "public",
    "fonts",
    "myriad-pro-black.otf"
  );
  const buf = await fs.readFile(fontPath);
  cachedFont = buf.buffer.slice(
    buf.byteOffset,
    buf.byteOffset + buf.byteLength
  );
  return cachedFont;
}

/**
 * Pre-fetch a remote image and inline it as a base64 data URL. Satori
 * can technically fetch image src URLs itself, but it's flaky in
 * serverless (no consistent fetch agent) and silently drops the image
 * on failure. Pre-fetching server-side is bulletproof.
 */
async function fetchAsDataUrl(url: string): Promise<string | null> {
  if (!url) return null;
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) {
      console.warn(`[png-renderer] image fetch failed ${res.status}: ${url}`);
      return null;
    }
    const buf = Buffer.from(await res.arrayBuffer());
    let contentType = res.headers.get("content-type") || "";
    if (!contentType.startsWith("image/")) {
      // Sniff from extension as a fallback
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
    console.warn(`[png-renderer] image fetch threw: ${url}`, err);
    return null;
  }
}

interface PngInput {
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
 * Render the signature top section (logo + contact details) as a PNG.
 * Disclaimer text is intentionally rendered separately as live text in
 * the email body so the image stays small and the legal text is
 * indexable / accessible. The image is the "designer-quality" part.
 */
// Target display size in the email body. The Satori canvas is rendered
// at 2x this for retina sharpness, then resvg upscales to 3x for very
// crisp display when the recipient zooms in.
export const SIG_DISPLAY_WIDTH = 314;
export const SIG_DISPLAY_HEIGHT = 154;
const RENDER_SCALE = 2;
const CANVAS_W = SIG_DISPLAY_WIDTH * RENDER_SCALE; // 628
const CANVAS_H = SIG_DISPLAY_HEIGHT * RENDER_SCALE; // 308

export async function renderSignaturePng(input: PngInput): Promise<Buffer> {
  const [fontData, logoDataUrl, badgeDataUrl] = await Promise.all([
    loadMyriadProFont(),
    fetchAsDataUrl(input.logoUrl),
    fetchAsDataUrl(input.badgeUrl),
  ]);

  const FONT = "Myriad Pro";
  const BLACK = "#000000";

  // Layout sizes are scaled to fit a 314x154 display target. All numbers
  // here are in 2x logical pixels (so divide by 2 mentally to imagine
  // what the recipient sees).
  const LOGO_W = 110;
  const BADGE_W = 92;

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
        style: { width: BADGE_W, marginTop: 10, objectFit: "contain" },
      },
    });
  }

  const rightChildren: any[] = [];
  rightChildren.push({
    type: "div",
    props: {
      style: {
        fontSize: 22,
        fontWeight: 900,
        color: BLACK,
        lineHeight: 1.1,
        marginBottom: 2,
      },
      children: input.senderName,
    },
  });
  if (input.senderTitle) {
    rightChildren.push({
      type: "div",
      props: {
        style: {
          fontSize: 9,
          fontWeight: 900,
          color: BLACK,
          textTransform: "uppercase",
          letterSpacing: 1.4,
          marginBottom: 10,
        },
        children: input.senderTitle,
      },
    });
  }
  if (input.senderPhone) {
    rightChildren.push({
      type: "div",
      props: {
        style: {
          fontSize: 18,
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
          fontSize: 18,
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
    props: { style: { height: 8 } },
  });
  if (input.addressLine1) {
    rightChildren.push({
      type: "div",
      props: {
        style: {
          fontSize: 7,
          fontWeight: 900,
          color: BLACK,
          textTransform: "uppercase",
          letterSpacing: 1,
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
          fontSize: 7,
          fontWeight: 900,
          color: BLACK,
          textTransform: "uppercase",
          letterSpacing: 1,
          lineHeight: 1.5,
        },
        children: input.addressLine2,
      },
    });
  }
  if (input.website) {
    rightChildren.push({
      type: "div",
      props: { style: { height: 6 } },
    });
    const display = input.website.replace(/^https?:\/\//, "");
    rightChildren.push({
      type: "div",
      props: {
        style: {
          fontSize: 11,
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
        padding: 12,
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
              paddingRight: 14,
              borderRight: "2px solid #000000",
              minWidth: 130,
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
              paddingLeft: 14,
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
        data: fontData,
        weight: 900,
        style: "normal",
      },
      {
        name: FONT,
        data: fontData,
        weight: 400,
        style: "normal",
      },
    ],
  });

  // Render at 2x display size = 628 wide. Combined with the explicit
  // width="314" + inline width:314px on the <img>, Outlook displays it
  // at 314 CSS pixels and the 2x source provides crisp retina output.
  // Pure-native 314 was too soft; pure-942 (3x) was too big in clients
  // that ignore the width attribute.
  const resvg = new Resvg(svg, {
    fitTo: { mode: "width", value: SIG_DISPLAY_WIDTH * 2 },
  });
  const png = resvg.render().asPng();
  return Buffer.from(png);
}
