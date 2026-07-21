import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options */
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  }
};

export default nextConfig;
