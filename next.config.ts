import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // output: "export",
  // The browser tests build into their own folder so they can run while the
  // development server is using .next.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // Keeps the framework's development badge off the screen.
  devIndicators: false,
  // Workout pictures are loaded from the free-exercise-db project.
  images: {
    remotePatterns: [{ protocol: "https", hostname: "raw.githubusercontent.com", pathname: "/yuhonas/free-exercise-db/**" }],
  },
  experimental: {
    // Attendance files exported from the biometric machine can be several MB.
    serverActions: { bodySizeLimit: "25mb" },
  },
};

export default nextConfig;
