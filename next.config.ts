import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    "/api/export/requests/**": ["./src/lib/templates/**"],
  },
};

export default nextConfig;
