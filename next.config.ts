import type { NextConfig } from "next";

const apiTarget = process.env.COCOWHEELS_API_PROXY_TARGET;

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async headers() {
    return [{ source: "/indexnow-key.txt", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] }];
  },
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
