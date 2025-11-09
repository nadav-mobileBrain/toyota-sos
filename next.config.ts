import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    turbopack: false, // Disable Turbopack to avoid compilation issues
  },
};

export default nextConfig;
