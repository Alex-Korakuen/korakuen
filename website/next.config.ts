import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: '/ap-calendar',
        destination: '/calendar',
        permanent: true,
      },
      {
        source: '/ar-outstanding',
        destination: '/calendar',
        permanent: true,
      },
    ]
  },
};

export default nextConfig;
