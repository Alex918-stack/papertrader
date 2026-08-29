import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Google's OAuth avatar_url/picture is the only external image source
    // with a fixed, known host - safe to allowlist outright. News article
    // images come from whatever publisher the news API returns (unbounded,
    // unpredictable hosts), so those stay on a plain <img> rather than
    // widening this to a wildcard host, which would let next/image proxy
    // and optimize requests to arbitrary external domains.
    remotePatterns: [
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
    ],
  },
};

export default nextConfig;
