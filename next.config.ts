import type { NextConfig } from "next";

const appVersion = process.env.npm_package_version ?? '0.0.0';

const nextConfig: NextConfig = {
  transpilePackages: ['recharts'],
  env: {
    NEXT_PUBLIC_APP_VERSION: appVersion,
  },
};

export default nextConfig;
