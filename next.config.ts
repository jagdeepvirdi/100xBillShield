import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Bill files (up to 4 MB) go through a server action; the default limit is 1 MB.
    serverActions: { bodySizeLimit: "5mb" },
  },
};

export default nextConfig;
