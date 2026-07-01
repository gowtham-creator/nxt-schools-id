import "server-only";

// Chromium singleton for the card render pipeline (PHASE-2-3-ARCHITECTURE §2.5).
//
// Reuse ONE warm `Browser` across requests; callers close the *page*, never the
// browser. On serverless (Vercel / AWS Lambda) we launch the bundled
// `@sparticuz/chromium`; locally we point puppeteer-core at the system Chrome.

import chromium from "@sparticuz/chromium";
import puppeteer, { type Browser } from "puppeteer-core";

let browserPromise: Promise<Browser> | null = null;

const isServerless = (): boolean =>
  Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);

async function launch(): Promise<Browser> {
  if (isServerless()) {
    return puppeteer.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: true,
    });
  }

  return puppeteer.launch({
    executablePath:
      process.env.CHROME_PATH ||
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    headless: true,
    args: ["--no-sandbox", "--font-render-hinting=none"],
  });
}

/**
 * Return the shared `Browser`, launching it on first use. The launch promise is
 * cached module-level; if a launch fails the cache is cleared so the next call
 * retries instead of resolving a dead browser.
 */
export async function getBrowser(): Promise<Browser> {
  if (!browserPromise) {
    browserPromise = launch().catch((err) => {
      browserPromise = null;
      throw err;
    });
  }
  return browserPromise;
}
