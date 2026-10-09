import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the workspace root to this project (a stray lockfile exists in the home dir).
  turbopack: { root: __dirname },
  // Admin image uploads go through Server Actions, which cap the request body at 1 MB by default.
  // Raw uploads are validated up to 5 MB (then compressed to WebP server-side), so lift the limit.
  experimental: {
    serverActions: { bodySizeLimit: "6mb" },
  },
  // How long an expired storefront page (see `revalidate` in the store layout) may still be served
  // while a fresh one renders in the background. The default is a year, which on a low-traffic
  // product page meant every visitor saw whatever the previous visitor triggered. Past 5 minutes,
  // the next visitor waits for a fresh render instead.
  expireTime: 300,
  // `src/lib/locations.ts` reads data/ph-locations.json with a path built at RUNTIME, which Next's
  // file tracing cannot see — so without this the file is left out of the deployed bundle and the
  // checkout address dropdowns come up empty in production while working perfectly in dev.
  // Scoped to "/**" rather than just "/checkout": `(store)/actions.ts` is imported by the inquiry
  // forms too, so the Server Action that reads this file can be resolved against a route other than
  // the one that rendered it. Costs nothing — the standalone output holds one copy however many
  // routes declare it — and the failure it prevents is empty address dropdowns in production while
  // everything works locally.
  outputFileTracingIncludes: {
    "/**": ["./data/ph-locations.json"],
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
