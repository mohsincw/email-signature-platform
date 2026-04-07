import { SetMetadata } from "@nestjs/common";
import { IS_PUBLIC_KEY } from "./auth.guard";

/** Mark a route as public (no JWT required) */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
