import type { NextConfig } from "next";

const bffDev = process.env.NODE_ENV === "development" && process.env.NEXT_PUBLIC_CPM_BFF_DEV === "1";
const nextConfig: NextConfig = {
  distDir: bffDev ? ".next-bff" : ".next",
  async rewrites() {
    if (bffDev) return [{ source: "/bff/:path*", destination: "http://127.0.0.1:8001/bff/:path*" }];
    return process.env.NODE_ENV === "production"
      ? [{ source: "/bff/:path*", destination: "http://127.0.0.1:19445/bff/:path*" }]
      : [];
  },
  async headers() { return bffDev ? [{ source: "/:path*", headers: [{ key: "Content-Security-Policy", value: "connect-src 'self' http://127.0.0.1:19000 ws://127.0.0.1:3001; form-action 'self'; object-src 'none'" }] }] : []; },
  turbopack: {
    resolveAlias: {
      fs: { browser: "./lib/homework-scanner/browser-node-shim.ts" },
      path: { browser: "./lib/homework-scanner/browser-node-shim.ts" },
      crypto: { browser: "./lib/homework-scanner/browser-node-shim.ts" },
    },
  },
  webpack(config) {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      path: false,
      crypto: false,
    };
    return config;
  },
};

export default nextConfig;
