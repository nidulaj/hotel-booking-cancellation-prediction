import type { NextConfig } from "next";

// Where the Next.js server forwards /api/* requests. Only the Next.js server
// talks to Flask, so the browser never needs to reach port 5000 directly.
const BACKEND_URL = (process.env.BACKEND_URL || "http://127.0.0.1:5000").replace(/\/+$/, "");

const nextConfig: NextConfig = {
  // Let the dev server be opened through VS Code port-forwarding tunnels.
  allowedDevOrigins: ["*.devtunnels.ms"],
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${BACKEND_URL}/api/:path*` }];
  },
};

export default nextConfig;
