import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep the headless-Chromium deps out of the bundler — they load native/binary
  // assets at runtime and must stay external (Node require) in server code.
  serverExternalPackages: ["puppeteer-core", "@sparticuz/chromium"],
  // The chromium .br binary archives are read from disk at runtime (never
  // require()d), so Vercel's file tracing drops them unless forced in. Card
  // generation runs via server actions on the /members route. Both globs cover
  // the symlinked and real (.pnpm) layouts.
  outputFileTracingIncludes: {
    "/members": [
      "./node_modules/@sparticuz/chromium/bin/**",
      "./node_modules/.pnpm/@sparticuz+chromium@*/node_modules/@sparticuz/chromium/bin/**",
    ],
  },
};

export default nextConfig;
