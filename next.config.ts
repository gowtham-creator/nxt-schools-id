import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep the headless-Chromium deps out of the bundler — they load native/binary
  // assets at runtime and must stay external (Node require) in server code.
  serverExternalPackages: ["puppeteer-core", "@sparticuz/chromium"],
};

export default nextConfig;
