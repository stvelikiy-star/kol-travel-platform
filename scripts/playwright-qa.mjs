// Share the isolated QA browser dependency without modifying application dependencies.
export const { chromium } = await import(process.env.KOL_PLAYWRIGHT_MODULE || "playwright");
