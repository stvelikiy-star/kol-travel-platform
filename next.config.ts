import type { NextConfig } from "next";

// Keep editor images below common serverless request limits, with a
// strict 4 MiB file check inside the authenticated Server Action.
const nextConfig: NextConfig = {
  experimental: { serverActions: { bodySizeLimit: "4.4mb" } }
};
export default nextConfig;
