import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      // Exercises moved into /body, next to fasting. Old links and
      // bookmarks still land on the same section.
      { source: "/exercises", destination: "/body?tab=exercises", permanent: false },
    ];
  },
};

export default nextConfig;
