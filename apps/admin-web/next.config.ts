import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@esp/shared-types"],
};

export default nextConfig;
