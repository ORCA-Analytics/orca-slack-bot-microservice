import { Job } from "bullmq";
import { logger } from "@/utils/logger.js";
import { getScheduleById } from "@/data/schedules.js";
import { getBotTokenByWorkspaceId } from "@/clients/slack-token.js";
import { supabase } from "@/clients/supabase.js";
import { SlackClient } from "@/clients/slack.js";
import { processJobSchema } from "@/api/schemas.js";

let renderHtmlToPngBuffer: ((html: string) => Promise<Buffer>) | undefined;

import {
  logQueued,
  
  markRunning,
  markCompleted,
  markFailed,
  bumpScheduleTimes,
} from "@/lib/jobs.js";


export async function processJob(job: Job) {
  console.log(`Job started: ${job.id}`);

  const parsed = processJobSchema.parse(job.data);
  const { scheduleId, payload } = parsed;

  const runAt = new Date(job.timestamp ?? Date.now());
  const { runId } = await logQueued(scheduleId, runAt);

  const startedAt = Date.now();
  try {
    await markRunning(runId);

    const sched = await getScheduleById(scheduleId);
    const token = await getBotTokenByWorkspaceId(sched.workspace_id);

    const isPayloadEmpty = !payload.parentText && (!payload.parentBlocks || payload.parentBlocks.length === 0);
    
    let parentBlocks = payload.parentBlocks || [];
    let parentText = payload.parentText;
    let shouldUploadImageToThread = false;
    let fallbackRemoteUrl: string | undefined;
    let puppeteerBuffer: Buffer | undefined;

    if (isPayloadEmpty && sched.message_id) {
      try {
        const { data: messageData, error } = await supabase
          .from("slack_messages")
          .select("slack_block_json")
          .eq("id", sched.message_id)
          .eq("is_parent", true)
          .single();
        
        if (!error && messageData?.slack_block_json) {
          parentBlocks = messageData.slack_block_json;
          
          const textBlocks = parentBlocks.filter((block: any) => 
            block.type === 'header' || block.type === 'section'
          );
          
          if (textBlocks.length > 0) {
            const firstTextBlock = textBlocks[0];
            if (firstTextBlock.type === 'header') {
              parentText = firstTextBlock.text?.text || `Message from template ${sched.message_id}`;
            } else if (firstTextBlock.type === 'section') {
              parentText = firstTextBlock.text?.text || `Message from template ${sched.message_id}`;
            }
          } else {
            parentText = `Message from template ${sched.message_id}`;
          }
          
          const hasOnlyImagePlaceholders = parentBlocks.every((block: any) => 
            block.type === 'image' && block.image_url === '{{visualization_url}}'
          );
          
          if (hasOnlyImagePlaceholders) {
            logger.info({ scheduleId, messageId: sched.message_id }, "Template is visualization-only");
            parentBlocks = [];
          } else {
            parentBlocks = parentBlocks.map((block: any) => {
              if (block.type === 'image' && block.image_url === '{{visualization_url}}') {
                return null;
              }
              return block;
            }).filter(Boolean);
          }
          
          logger.info({ scheduleId, messageId: sched.message_id }, "Using message content from database");
        }
      } catch (e) {
        logger.error({ err: e, messageId: sched.message_id }, "Failed to fetch message content from database");
      }
    }

    if (payload.visualization?.html && process.env.RENDER_MODE === "puppeteer") {
      if (!renderHtmlToPngBuffer) {
        const { renderHtmlToPngBuffer: renderFn } = await import("../clients/renderer.js");
        renderHtmlToPngBuffer = renderFn;
      }
      try {
        puppeteerBuffer = await renderHtmlToPngBuffer(payload.visualization.html);
        shouldUploadImageToThread = true;
        
      } catch (e) {
        logger.error({ err: e }, "HTML render failed, falling back to imageUrl");
      }
    }

    if (payload.visualization?.imageUrl && !payload.visualization?.html) {
      try {
        new URL(payload.visualization.imageUrl);
        parentBlocks.push({
          type: 'image',
          image_url: payload.visualization.imageUrl,
          alt_text: payload.visualization.alt || payload.visualization.fileName || 'Visualization'
        });
      } catch (e) {
        shouldUploadImageToThread = true;
        fallbackRemoteUrl = payload.visualization.imageUrl;
      }
    }

    const slackClient = new SlackClient();
    
    const parentMessagePayload: any = {
      channel: sched.channel_id || process.env.SLACK_DEFAULT_CHANNEL || 'general',
      text: parentText ?? `Scheduled message for ${scheduleId}`,
    };
    
    if (parentBlocks.length > 0) {
      parentMessagePayload.blocks = parentBlocks;
    }
    
    const res = await slackClient.sendMessage(parentMessagePayload, token);
    
    if (!res.ok) {
      throw new Error(`Failed to send parent message: ${res.error}`);
    }

    if (payload.replyBlocks && payload.replyBlocks.length > 0 && res.ts) {
      for (const replyBlock of payload.replyBlocks) {
        const replyPayload: any = {
          channel: res.channel!,
          text: "Reply message",
          blocks: replyBlock,
          thread_ts: res.ts,
        };
        
        try {
          await slackClient.sendMessage(replyPayload, token);
        } catch (e) {
          logger.error({ err: e }, "Failed to send reply message");
        }
      }
    }

    // Upload image to thread if needed
    if (shouldUploadImageToThread && res.ts) {
      try {
        if (puppeteerBuffer) {
          await uploadImageToSlack({
            token,
            channel: res.channel!,
            thread_ts: res.ts,
            buffer: puppeteerBuffer,
            fileName: payload.visualization?.fileName || "visualization.png",
            title: payload.visualization?.alt || "Visualization",
          });
        } else if (fallbackRemoteUrl) {
          const imageBuffer = await downloadImageAsBuffer(fallbackRemoteUrl);
          await uploadImageToSlack({
            token,
            channel: res.channel!,
            thread_ts: res.ts,
            buffer: imageBuffer,
            fileName: payload.visualization?.fileName || "visualization.png",
            title: payload.visualization?.alt || "Visualization",
          });
        }
      } catch (e) {
        logger.error({ err: e }, "Image upload to thread failed");
      }
    }


    const durationMs = Date.now() - startedAt;
    const messageId = payload.messageId ?? sched.message_id ?? null;
    await markCompleted(runId, { 
      durationMs, 
      slackTs: res.ts || '', 
      slackChannel: res.channel || '', 
      messageId 
    });
    await bumpScheduleTimes(scheduleId, sched.cron_expr, sched.timezone, new Date());

    logger.info({ jobId: job.id, scheduleId, runId, durationMs, slackTs: res.ts, channel: res.channel, messageId }, "Job completed with Step 8");
    return res;
  } catch (err: any) {
    const durationMs = Date.now() - startedAt;
    await markFailed(runId, { durationMs, error: String(err?.data ?? err?.message ?? err) });
    try {
      const sched = await getScheduleById(scheduleId);
      await bumpScheduleTimes(scheduleId, sched.cron_expr, sched.timezone, new Date());
    } catch {}
    throw err;
  }
}

async function uploadImageToSlack({
  token,
  channel,
  thread_ts,
  buffer,
  fileName,
  title
}: {
  token: string;
  channel: string;
  thread_ts: string;
  buffer: Buffer;
  fileName: string;
  title: string;
}) {
  const formData = new FormData();
  
  const blob = new Blob([buffer], { type: 'image/png' });
  formData.append('file', blob, fileName);
  
  formData.append('channels', channel);
  formData.append('thread_ts', thread_ts);
  formData.append('title', title);
  formData.append('initial_comment', 'Generated visualization');
  
  const response = await fetch('https://slack.com/api/files.upload', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
    body: formData,
  });
  
  const result = await response.json() as any;
  
  if (!result.ok) {
    throw new Error(`Slack file upload failed: ${result.error}`);
  }
  
  return result;
}

async function downloadImageAsBuffer(imageUrl: string): Promise<Buffer> {
  const response = await fetch(imageUrl);
  
  if (!response.ok) {
    throw new Error(`Failed to download image: ${response.statusText}`);
  }
  
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}