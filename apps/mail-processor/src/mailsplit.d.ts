/* Minimal ambient declarations for mailsplit — enough to type
 * Splitter / Joiner / Rewriter as Transform streams for our use
 * case. Upstream mailsplit is a plain JS package with no typings.
 */
declare module "mailsplit" {
  import { Transform } from "stream";

  export class Splitter extends Transform {
    constructor(options?: Record<string, unknown>);
  }

  export class Joiner extends Transform {
    constructor(options?: Record<string, unknown>);
  }

  export class Rewriter extends Transform {
    constructor(filter: (node: any) => boolean);
    on(event: "node", listener: (data: any) => void): this;
    on(event: string, listener: (...args: any[]) => void): this;
  }

  export class HeaderSplitter extends Transform {
    constructor(options?: Record<string, unknown>);
  }
}
