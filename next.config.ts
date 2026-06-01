import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // instrumentation.ts is auto-loaded in Next.js 15 — no config needed.
  // It applies the localStorage SSR polyfill before any route renders.
};

export default nextConfig;
