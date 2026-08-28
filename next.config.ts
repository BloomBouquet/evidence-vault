import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  basePath: "/apps/evidence-vault",
};

export default nextConfig;
