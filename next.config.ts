import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // output: "export",
  // Keeps the framework's development badge off the screen.
  devIndicators: false,
  experimental: {
    // Attendance files exported from the biometric machine can be several MB.
    serverActions: { bodySizeLimit: "25mb" },
  },
};

export default nextConfig;
