import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@esp/shared-types",
    "@esp/database",
    "@esp/signature-renderer",
  ],
  // Prisma + other Node-only libs should stay external (not bundled)
  serverExternalPackages: [
    "@prisma/client",
    "@azure/identity",
    "@microsoft/microsoft-graph-client",
    "nodemailer",
    "@aws-sdk/client-s3",
    "@aws-sdk/s3-request-presigner",
    "bcryptjs",
    "@resvg/resvg-js",
  ],
  // Bundle the brand fonts with the serverless functions so the PNG
  // renderer can read them at runtime.
  outputFileTracingIncludes: {
    "/api/senders/**": ["./public/fonts/**"],
  },
  outputFileTracingRoot: path.join(__dirname, "../.."),
};

export default nextConfig;
