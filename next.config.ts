import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the workspace root to this project (a stray lockfile exists in the home dir).
  turbopack: { root: __dirname },
  // Placeholder product imagery is served from picsum.photos in the seed catalog.
  // Swap/remove these remote patterns once real product images are hosted (Phase 4 admin).
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "picsum.photos" },
      { protocol: "https", hostname: "fastly.picsum.photos" },
    ],
  },
};

export default nextConfig;
