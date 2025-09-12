import { WebClient } from "@slack/web-api";
import { logger } from "../utils/logger.js";

export function getSlackClient(token?: string) {
  const resolved = token || process.env.SLACK_BOT_TOKEN;
  if (!resolved) throw new Error("Missing Slack bot token (SLACK_BOT_TOKEN)");
  return new WebClient(resolved);
}

type Block = any;

export function ensureImageInBlocks(blocks: Block[], imageUrl?: string, title?: string): Block[] {
  if (!imageUrl) return blocks;
  const hasImage = blocks.some((b: any) => b?.type === "image");
  if (hasImage) return blocks;
  return [
    ...blocks,
    {
      type: "image",
      image_url: imageUrl,
      alt_text: title || "Visualization",
      title: title ? { type: "plain_text", text: title } : undefined,
    },
  ];
}

export async function postParentAndReplies(opts: {
  token?: string;
  channel?: string;
  defaultChannel?: string;
  parentBlocks: Block[];
  parentText?: string;
  replyBlocks?: Block[][];
}) {
  const { token, channel, defaultChannel, parentBlocks, parentText, replyBlocks } = opts;
  const client = getSlackClient(token);
  const targetChannel = channel || defaultChannel;
  if (!targetChannel) throw new Error("Slack channel is required");

  try {
    const parent = await client.chat.postMessage({
      channel: targetChannel,
      text: parentText ?? "ORCA scheduled message",
      blocks: parentBlocks,
    });

    if (replyBlocks?.length) {
      for (const blocks of replyBlocks) {
        const replyArgs: any = {
          channel: targetChannel,
          text: "Reply",
          blocks,
          reply_broadcast: false,
        };
        if (parent.ts) {
          replyArgs.thread_ts = parent.ts;
        }
        await client.chat.postMessage(replyArgs);
      }
    }

    return { channel: parent.channel as string, ts: parent.ts as string };
  } catch (err: any) {
    logger.error({ err }, "Slack post failed");
    throw err;
  }
}

export async function isPublicImage(url: string, timeoutMs = 3000): Promise<boolean> {
  try {
    const ctrl = new AbortController();
    const to = setTimeout(() => ctrl.abort(), timeoutMs);

    let res = await fetch(url, { method: "HEAD", signal: ctrl.signal });
    clearTimeout(to);

    if (!res.ok) return false;
    const ct = (res.headers.get("content-type") || "").toLowerCase();
    if (ct.includes("image/")) return true;

    const ctrl2 = new AbortController();
    const to2 = setTimeout(() => ctrl2.abort(), timeoutMs);
    res = await fetch(url, { method: "GET", headers: { Range: "bytes=0-0" }, signal: ctrl2.signal });
    clearTimeout(to2);
    if (!res.ok) return false;
    const ct2 = (res.headers.get("content-type") || "").toLowerCase();
    return ct2.includes("image/");
  } catch {
    return false;
  }
}

export async function downloadAsBuffer(url: string, timeoutMs = 8000): Promise<{ buffer: Buffer; fileName: string }> {
  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort(), timeoutMs);
  const res = await fetch(url, { signal: ctrl.signal });
  clearTimeout(to);
  if (!res.ok) throw new Error(`Failed to download image: ${res.status}`);
  const ab = await res.arrayBuffer();
  const buffer = Buffer.from(ab);
  const u = new URL(url);
  const fileName = u.pathname.split("/").pop() || "visualization";
  return { buffer, fileName };
}

export async function uploadBuffer(opts: {
  token?: string;
  channel: string;
  thread_ts?: string;
  buffer: Buffer;
  fileName?: string;
  title?: string;
}) {
  const { token, channel, thread_ts, buffer, fileName = "visualization.png", title = "Visualization" } = opts;
  const client = getSlackClient(token);
  const uploadArgs: any = {
    channel_id: channel,
    filename: fileName,
    title,
    file: buffer,
  };
  if (thread_ts) {
    uploadArgs.thread_ts = thread_ts;
  }
  const res = await client.files.uploadV2(uploadArgs);
  return res;
}
