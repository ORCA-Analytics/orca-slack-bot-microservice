import puppeteer from "puppeteer";

const WRAP = (inner: string) => `<!doctype html>
<html><head><meta charset="utf-8"/>
<style>
  *{box-sizing:border-box}
  body{margin:0;padding:24px;background:#fff}
  table{border-collapse:collapse;table-layout:auto;width:max-content;max-width:unset}
  th,td{padding:10px 14px;border-bottom:1px solid #e6e6e6;white-space:nowrap}
  thead th{background:#c9ece8;font-weight:600}
  .num{ text-align:right; font-variant-numeric: tabular-nums }
  #root{display:inline-block}
</style></head>
<body><div id="root">${inner}</div></body></html>`;

const EXEC_PATH = process.env.PUPPETEER_EXECUTABLE_PATH || "/usr/bin/chromium";
const LAUNCH_ARGS = [
  "--no-sandbox","--disable-setuid-sandbox","--disable-dev-shm-usage",
  "--no-zygote","--single-process","--disable-gpu",
];

export async function renderHtmlToPngBuffer(html: string): Promise<Buffer> {
  const possiblePaths = [
    EXEC_PATH,
    "/usr/bin/chromium-browser",
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium"
  ];

  let executablePath = EXEC_PATH;
  for (const path of possiblePaths) {
    try {
      const fs = await import("fs");
      if (fs.existsSync(path)) {
        executablePath = path;
        break;
      }
    } catch {
    }
  }

  const browser = await puppeteer.launch({
    headless: true,
    executablePath,
    args: LAUNCH_ARGS,
    timeout: Number(process.env.PPTR_LAUNCH_TIMEOUT ?? 90000),
    defaultViewport: { width: 1280, height: 800, deviceScaleFactor: 2 },
  });

  try {
    const page = await browser.newPage();
    await page.emulateMediaType("screen");
    await page.setContent(WRAP(html), { waitUntil: "networkidle0", timeout: Number(process.env.PPTR_PAGE_TIMEOUT ?? 60000) });
    await page.evaluateHandle("document.fonts && document.fonts.ready");

    const el = await page.$("#root");
    if (!el) throw new Error("root element not found");
    const box = await el.boundingBox();
    if (!box) throw new Error("no bounding box");

    const clip = {
      x: Math.max(0, Math.floor(box.x)),
      y: Math.max(0, Math.floor(box.y)),
      width: Math.min(2200, Math.ceil(box.width)),
      height: Math.min(2200, Math.ceil(box.height)),
    };

    return (await page.screenshot({ type: "png", clip })) as Buffer;
  } finally {
    await browser.close().catch(() => {});
  }
}