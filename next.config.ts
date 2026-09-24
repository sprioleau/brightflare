import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  allowedDevOrigins: process.env.BRIGHTFLARE_DEV_HOST ? [process.env.BRIGHTFLARE_DEV_HOST] : [],
};

export default nextConfig;
