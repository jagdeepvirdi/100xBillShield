import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Bill photos go through a server action; the default limit is 1 MB.
    serverActions: { bodySizeLimit: "10mb" },
  },
};

export default nextConfig;
