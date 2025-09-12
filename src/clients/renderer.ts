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

export async function renderHtmlToPngBuffer(html: string): Promise<Buffer> {
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  try {
    const page = await browser.newPage();
    await page.setContent(WRAP(html), { waitUntil: "networkidle0" });

    const { w, h } = await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const doc = (globalThis as any).document;
      return {
        w: Math.ceil(doc.documentElement.scrollWidth),
        h: Math.ceil(doc.documentElement.scrollHeight),
      };
    });
    const width  = Math.min(w, 2200);
    const height = Math.min(h, 2200);
    await page.setViewport({ width, height, deviceScaleFactor: 2 });

    const png = await page.screenshot({ type: "png", fullPage: false }) as Buffer;
    return png;
  } finally {
    await browser.close();
  }
}
