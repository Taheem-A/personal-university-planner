import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: [
    "@university-planner/domain",
    "@university-planner/shared",
    "@university-planner/planner-core",
  ],
};

export default nextConfig;
