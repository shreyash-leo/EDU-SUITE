import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";

export default function config(phase: string): NextConfig {
  return {
    output: "standalone",
    poweredByHeader: false,
    // Keep next build from replacing chunks used by an active next dev process.
    distDir:
      process.env.PLAN_NEXT_DIST_DIR ||
      (phase === PHASE_DEVELOPMENT_SERVER ? ".next-dev" : ".next"),
    async rewrites() {
      return [
        {
          source: "/api/:path*",
          destination: `${process.env.API_INTERNAL_URL || "http://localhost:4000"}/api/:path*`,
        },
      ];
    },
  };
}
