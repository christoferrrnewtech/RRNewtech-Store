import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the workspace root to this project (a stray lockfile exists in the home dir).
  turbopack: { root: __dirname },
  // Admin image uploads go through Server Actions, which cap the request body at 1 MB by default.
  // Raw uploads are validated up to 5 MB (then compressed to WebP server-side), so lift the limit.
  experimental: {
    serverActions: { bodySizeLimit: "6mb" },
  },
  // Placeholder product imagery is served from picsum.photos in the seed catalog.
  // Swap/remove these remote patterns once real product images are hosted (Phase 4 admin).
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "picsum.photos" },
      { protocol: "https", hostname: "fastly.picsum.photos" },
      // Admin-uploaded images (banners, brand logos/heroes, gallery) served from Firebase Storage.
      { protocol: "https", hostname: "firebasestorage.googleapis.com" },
    ],
  },
};

export default nextConfig;
