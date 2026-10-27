import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@repo/core", "@repo/api-client", "@repo/design-tokens"],
  async redirects() {
    return [
      { source: "/app", destination: "/app/overview", permanent: false },
      { source: "/app/settings", destination: "/app/settings/profile", permanent: false },
      { source: "/onboarding", destination: "/onboarding/1", permanent: false },
    ];
  },
};

export default nextConfig;
