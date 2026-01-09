import type { NextConfig } from 'next';

const appVersion = process.env.npm_package_version ?? '0.0.0';

const nextConfig: NextConfig = {
  transpilePackages: ['recharts'],
  env: {
    NEXT_PUBLIC_APP_VERSION: appVersion,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**', // Allow all hostnames for Supabase storage to support multiple environments
        port: '',
        pathname: '/storage/v1/object/public/**',
      },
      {
        protocol: 'https',
        hostname: '**', // Allow all hostnames for Supabase storage to support multiple environments
        port: '',
        pathname: '/storage/v1/object/sign/**',
      },
    ],
  },
};

export default nextConfig;
