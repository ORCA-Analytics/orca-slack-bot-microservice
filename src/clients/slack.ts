import { WebClient, type ChatPostMessageArguments, type KnownBlock } from "@slack/web-api";
import { logger } from "@/utils/logger.js";

export function getSlackClient(token?: string) {
  const resolved = token || process.env.SLACK_BOT_TOKEN;
  if (!resolved) throw new Error("Missing Slack bot token (SLACK_BOT_TOKEN)");
  return new WebClient(resolved);
}

type Block = any;

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
    // parent
    const parent = await client.chat.postMessage({
      channel: targetChannel,
      text: parentText ?? "ORCA scheduled message",
      blocks: parentBlocks,
    });

    // replies
    if (replyBlocks?.length) {
      for (const blocks of replyBlocks) {
        const base: ChatPostMessageArguments = {
          channel: targetChannel,
          text: "Reply",
          blocks: blocks as (KnownBlock | Block)[],
          reply_broadcast: false,
        };
    
        const args: ChatPostMessageArguments = parent.ts
          ? { ...base, thread_ts: parent.ts }
          : base;
    
        await client.chat.postMessage(args);
      }
    }

    return { channel: parent.channel as string, ts: parent.ts as string };
  } catch (err: any) {
    logger.error({ err }, "Slack post failed");
    throw err;
  }
}
