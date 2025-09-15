import { Job } from "bullmq";
import { z } from "zod";
import { logger } from "@/utils/logger.js";
import { getScheduleById } from "@/data/schedules.js";
import { getBotTokenByWorkspaceId } from "@/clients/slack-token.js";
import { supabase } from "@/clients/supabase.js";
import {
  postParentAndReplies,
  ensureImageInBlocks,
  isPublicImage,
  downloadAsBuffer,
  uploadBuffer,
} from "@/clients/slack.js";

let renderHtmlToPngBuffer: ((html: string) => Promise<Buffer>) | undefined;

import {
  logQueued,
  
  markRunning,
  markCompleted,
  markFailed,
  bumpScheduleTimes,
} from "@/lib/jobs.js";

const blocksSchema = z.array(z.any());
const jobDataSchema = z.object({
  scheduleId: z.string().uuid(),
  payload: z.object({
    parentText: z.string().optional(),
    parentBlocks: blocksSchema.optional(),
    replyBlocks: z.array(blocksSchema).optional(),
    visualization: z.object({
      imageUrl: z.string().url().optional(),
      html: z.string().optional(),
      fileName: z.string().optional(),
      alt: z.string().optional(),
    }).optional(),
    messageId: z.string().optional(),
  }),
});

export async function processJob(job: Job) {
  const parsed = jobDataSchema.parse(job.data);
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
      const ok = await isPublicImage(payload.visualization.imageUrl);
      if (ok) {
        parentBlocks = ensureImageInBlocks(
          parentBlocks,
          payload.visualization.imageUrl,
          payload.visualization.alt || payload.visualization.fileName
        );
      } else {
        shouldUploadImageToThread = true;
        fallbackRemoteUrl = payload.visualization.imageUrl;
      }
    }

    const postArgs: any = {
      token,
      parentBlocks,
      parentText: parentText ?? `Scheduled message for ${scheduleId}`,
    };
    if (sched.channel_id) {
      postArgs.channel = sched.channel_id;
    }
    if (process.env.SLACK_DEFAULT_CHANNEL) {
      postArgs.defaultChannel = process.env.SLACK_DEFAULT_CHANNEL;
    }
    if (payload.replyBlocks) {
      postArgs.replyBlocks = payload.replyBlocks;
    }
    const res = await postParentAndReplies(postArgs);

    if (shouldUploadImageToThread) {
      try {
        if (puppeteerBuffer) {

          await uploadBuffer({
            token,
            channel: res.channel,
            thread_ts: res.ts,
            buffer: puppeteerBuffer,
            fileName: payload.visualization?.fileName || "visualization.png",
            title: payload.visualization?.alt || "Visualization",
          });
        } else if (fallbackRemoteUrl) {
          const { buffer, fileName } = await downloadAsBuffer(fallbackRemoteUrl);
          await uploadBuffer({
            token,
            channel: res.channel,
            thread_ts: res.ts,
            buffer,
            fileName: payload.visualization?.fileName || fileName,
            title: payload.visualization?.alt || "Visualization",
          });
        }
      } catch (e) {
        logger.error({ err: e }, "Image upload to thread failed");
      }
    }


    const durationMs = Date.now() - startedAt;
    const messageId = payload.messageId ?? sched.message_id ?? null;
    await markCompleted(runId, { durationMs, slackTs: res.ts, slackChannel: res.channel, messageId });
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