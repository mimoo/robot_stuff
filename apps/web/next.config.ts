import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow importing the workspace `@robot/shared` TS package directly.
  transpilePackages: ["@robot/shared"],
  reactStrictMode: true,
};

export default nextConfig;
