import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  turbopack: {},
  output: process.env.VERCEL ? undefined : "standalone",
  outputFileTracingIncludes: {
    "/dashboard/schedule": [
      "./node_modules/pdfjs-dist/**/*",
      "./scripts/parse-schedule-pdf.cjs",
    ],
  },
};

export default nextConfig;
