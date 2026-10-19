import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Static HTML/JS in out/, which Capacitor bundles into the iOS app.
  output: "export",
  images: {
    // No server to optimize images in a static export; card scans load directly.
    unoptimized: true,
  },
};

export default nextConfig;
