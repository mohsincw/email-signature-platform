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
export async function renderSignaturePng(input: PngInput): Promise<Buffer> {
  const fontData = await loadMyriadProFont();

  const FONT = "Myriad Pro";
  const BLACK = "#000000";

  const leftChildren: any[] = [];
  if (input.logoUrl) {
    leftChildren.push({
      type: "img",
      props: {
        src: input.logoUrl,
        width: 140,
        style: { width: 140, objectFit: "contain" },
      },
    });
  }
  if (input.badgeUrl) {
    leftChildren.push({
      type: "img",
      props: {
        src: input.badgeUrl,
        width: 110,
        style: { width: 110, marginTop: 14, objectFit: "contain" },
      },
    });
  }

  const rightChildren: any[] = [];
  rightChildren.push({
    type: "div",
    props: {
      style: {
        fontSize: 36,
        fontWeight: 900,
        color: BLACK,
        lineHeight: 1.1,
        marginBottom: 4,
      },
      children: input.senderName,
    },
  });
  if (input.senderTitle) {
    rightChildren.push({
      type: "div",
      props: {
        style: {
          fontSize: 13,
          fontWeight: 900,
          color: BLACK,
          textTransform: "uppercase",
          letterSpacing: 2,
          marginBottom: 18,
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
          fontSize: 28,
          fontWeight: 900,
          color: BLACK,
          lineHeight: 1.2,
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
          fontSize: 28,
          fontWeight: 900,
          color: BLACK,
          lineHeight: 1.2,
        },
        children: input.senderPhone2,
      },
    });
  }
  rightChildren.push({
    type: "div",
    props: { style: { height: 18 } },
  });
  if (input.addressLine1) {
    rightChildren.push({
      type: "div",
      props: {
        style: {
          fontSize: 11,
          fontWeight: 900,
          color: BLACK,
          textTransform: "uppercase",
          letterSpacing: 1.5,
          lineHeight: 1.6,
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
          fontSize: 11,
          fontWeight: 900,
          color: BLACK,
          textTransform: "uppercase",
          letterSpacing: 1.5,
          lineHeight: 1.6,
        },
        children: input.addressLine2,
      },
    });
  }
  if (input.website) {
    rightChildren.push({
      type: "div",
      props: {
        style: { height: 14 },
      },
    });
    const display = input.website.replace(/^https?:\/\//, "");
    rightChildren.push({
      type: "div",
      props: {
        style: {
          fontSize: 18,
          fontWeight: 400,
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
        padding: 24,
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
              paddingRight: 28,
              borderRight: "2px solid #000000",
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
              paddingLeft: 28,
              justifyContent: "center",
            },
            children: rightChildren,
          },
        },
      ],
    },
  };

  const svg = await satori(tree as any, {
    width: 720,
    height: 280,
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

  const resvg = new Resvg(svg, {
    fitTo: { mode: "width", value: 1440 }, // 2x DPI for retina
  });
  const png = resvg.render().asPng();
  return Buffer.from(png);
}
