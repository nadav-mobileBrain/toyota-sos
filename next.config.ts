import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ['recharts'],
  // Ensure recharts is properly resolved by Turbopack
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
      };
    }
    return config;
  },
};

export default nextConfig;
