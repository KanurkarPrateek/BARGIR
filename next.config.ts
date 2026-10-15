import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // output: "export",
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
