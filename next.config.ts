import type { NextConfig } from "next";

const apiTarget = process.env.COCOWHEELS_API_PROXY_TARGET;

const nextConfig: NextConfig = {
  async rewrites() {
    if (!apiTarget) return [];
    return [
      {
        source: "/api/:path*",
        destination: `${apiTarget.replace(/\/$/, "")}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
