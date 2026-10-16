import type { NextConfig } from "next";

const bffDev = process.env.NODE_ENV === "development" && process.env.NEXT_PUBLIC_CPM_BFF_DEV === "1";
// Optional loopback adapter for local UI work against the existing HTTPS BFF.
const devProxy = bffDev ? process.env.CPM_BFF_DEV_PROXY_ORIGIN || "http://127.0.0.1:8001" : "";
if (bffDev && !/^http:\/\/127\.0\.0\.1:\d+$/.test(devProxy)) {
  throw new Error("CPM_BFF_DEV_PROXY_ORIGIN must be an HTTP loopback origin");
}
const nextConfig: NextConfig = {
  devIndicators: bffDev ? false : undefined,
  distDir: bffDev ? ".next-bff" : ".next",
  async rewrites() { return bffDev ? [{ source: "/bff/:path*", destination: `${devProxy}/bff/:path*` }] : []; },
  async headers() { return bffDev ? [{ source: "/:path*", headers: [{ key: "Content-Security-Policy", value: "connect-src 'self' https://s3.twcstorage.ru http://127.0.0.1:19000 ws://localhost:3000 ws://127.0.0.1:3000 ws://127.0.0.1:3001; form-action 'self'; object-src 'none'" }] }] : []; },
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
