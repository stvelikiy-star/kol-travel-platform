import { chromium } from "playwright";

const base = "http://127.0.0.1:3100";
const profiles = [
  ["desktop", { width: 1280, height: 800 }],
  ["mobile", { width: 390, height: 844 }]
];

const browser = await chromium.launch({ headless: true });

try {
  for (const [label, viewport] of profiles) {
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    const pageErrors = [];
    const consoleErrors = [];

    page.on("pageerror", (error) => pageErrors.push(String(error)));
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });

    const response = await page.goto(`${base}/photo-credits`, {
      waitUntil: "domcontentloaded",
      timeout: 30000
    });

    if (!response || response.status() >= 400) {
      throw new Error(`${label}: photo credits returned HTTP ${response?.status()}`);
    }

    await page.getByRole("heading", { name: "Фотографии и лицензии", exact: true }).waitFor();

    const metrics = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
      bodyTextLength: document.body.innerText.trim().length
    }));

    if (metrics.scrollWidth > metrics.clientWidth + 2) {
      throw new Error(`${label}: photo credits horizontal overflow ${metrics.scrollWidth} > ${metrics.clientWidth}`);
    }
    if (metrics.bodyTextLength < 300) {
      throw new Error(`${label}: photo credits page is unexpectedly empty`);
    }

    const externalLinks = await page.locator('a[target="_blank"]').evaluateAll((links) =>
      links.map((link) => ({
        href: link.getAttribute("href"),
        rel: link.getAttribute("rel") ?? ""
      }))
    );

    if (externalLinks.length < 21) {
      throw new Error(`${label}: expected Wikimedia/license/Unsplash credit links; found ${externalLinks.length}`);
    }

    for (const link of externalLinks) {
      if (!link.href) throw new Error(`${label}: empty external photo-credit href`);
      const parsed = new URL(link.href);
      if (parsed.protocol !== "https:") throw new Error(`${label}: non-HTTPS photo-credit href ${link.href}`);
      if (!link.rel.split(/\s+/).includes("noreferrer")) {
        throw new Error(`${label}: external photo-credit link is missing noreferrer: ${link.href}`);
      }
    }

    await page.goto(base, { waitUntil: "domcontentloaded" });
    const footerCreditLink = page.locator('a[href="/photo-credits"]');
    if (!(await footerCreditLink.count())) {
      throw new Error(`${label}: public footer is missing /photo-credits link`);
    }

    if (pageErrors.length) throw new Error(`${label}: page errors: ${pageErrors.join(" | ")}`);
    const seriousConsole = consoleErrors.filter((text) => !/favicon|Failed to load resource.*404/i.test(text));
    if (seriousConsole.length) throw new Error(`${label}: console errors: ${seriousConsole.join(" | ")}`);

    await context.close();
  }
} finally {
  await browser.close();
}

console.log("KÖL photo credits QA: PASS");
