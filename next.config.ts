import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
