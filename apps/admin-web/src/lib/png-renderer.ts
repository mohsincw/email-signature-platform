import path from "path";
import {
  renderSignaturePng as rawRenderSignaturePng,
  loadFontFromPath,
  SIG_DISPLAY_WIDTH,
  SIG_DISPLAY_HEIGHT,
  type PngInput,
} from "@esp/signature-png";

export { SIG_DISPLAY_WIDTH, SIG_DISPLAY_HEIGHT, type PngInput };

let fontLoaded = false;

/**
 * Wrap the shared renderer so callers in the Next.js API routes don't
 * have to worry about font loading. The Myriad Pro .otf lives in
 * apps/admin-web/public/fonts and is bundled into the serverless
 * function via outputFileTracingIncludes in next.config.ts.
 */
export async function renderSignaturePng(input: PngInput): Promise<Buffer> {
  if (!fontLoaded) {
    const fontPath = path.join(
      process.cwd(),
      "public",
      "fonts",
      "myriad-pro-black.otf"
    );
    await loadFontFromPath(fontPath);
    fontLoaded = true;
  }
  return rawRenderSignaturePng(input);
}
