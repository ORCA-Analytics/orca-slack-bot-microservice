/// <reference lib="dom" />
import puppeteer from "puppeteer";

const WRAP = (inner: string) => `
<meta charset="utf-8"/>
<style>
  *{box-sizing:border-box}
  body{margin:0;padding:24px;background:#fff}
  table{border-collapse:collapse;table-layout:auto;width:max-content;max-width:unset}
  th,td{padding:10px 14px;border-bottom:1px solid #e6e6e6;white-space:nowrap}
  thead th{background:#c9ece8;font-weight:600}
  .num{ text-align:right; font-variant-numeric: tabular-nums }
</style>
${inner}
`;

const EXEC_PATH =
  process.env.PUPPETEER_EXECUTABLE_PATH || "/usr/bin/chromium-browser";

const LAUNCH_ARGS = [
  "--no-sandbox",
  "--disable-setuid-sandbox",
  "--disable-dev-shm-usage",
  "--no-zygote",
  "--single-process",
  "--disable-gpu",
];

export async function renderHtmlToPngBuffer(html: string): Promise<Buffer> {
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: EXEC_PATH,
    args: LAUNCH_ARGS,
    timeout: Number(process.env.PPTR_LAUNCH_TIMEOUT ?? 90000),
  });

  try {
    const page = await browser.newPage();

    await page.setViewport({ width: 1200, height: 800, deviceScaleFactor: 2 });

    await page.setContent(WRAP(html), {
      waitUntil: "networkidle0",
      timeout: Number(process.env.PPTR_PAGE_TIMEOUT ?? 60000),
    });

    const { w, h } = await page.evaluate(() => {
      const doc = document.documentElement;
      return { w: Math.ceil(doc.scrollWidth), h: Math.ceil(doc.scrollHeight) };
    });

    const width = Math.min(w, 2200);
    const height = Math.min(h, 2200);
    await page.setViewport({ width, height, deviceScaleFactor: 2 });

    const png = (await page.screenshot({ type: "png" })) as Buffer;
    return png;
  } finally {
    await browser.close().catch(() => {});
  }
}