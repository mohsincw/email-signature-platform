import type { NextConfig } from "next";

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
  ],
};

export default nextConfig;
