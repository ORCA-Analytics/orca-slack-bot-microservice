import { Job } from "bullmq";
import { z } from "zod";
import { logger } from "../utils/logger.js";
import { getScheduleById } from "../data/schedules.js";
import { getBotTokenByWorkspaceId } from "../clients/slack-token.js";
import { postParentAndReplies } from "../clients/slack.js";
import { logQueued, markRunning, markCompleted, markFailed, bumpScheduleTimes } from "../lib/jobs.js";

const blocksSchema = z.array(z.any());
const jobDataSchema = z.object({
  scheduleId: z.string().uuid(),
  payload: z.object({
    parentText: z.string().optional(),
    parentBlocks: blocksSchema,
    replyBlocks: z.array(blocksSchema).optional(),
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

    const res = await postParentAndReplies({
      token,
      ...(sched.channel_id && { channel: sched.channel_id }),
      ...(process.env.SLACK_DEFAULT_CHANNEL && { defaultChannel: process.env.SLACK_DEFAULT_CHANNEL }),
      parentBlocks: payload.parentBlocks,
      ...(payload.replyBlocks && { replyBlocks: payload.replyBlocks }),
      parentText: payload.parentText ?? `Scheduled message for ${scheduleId}`,
    });

    const durationMs = Date.now() - startedAt;
    await markCompleted(runId, {
      durationMs,
      slackTs: res.ts,
      slackChannel: res.channel,
    });

    await bumpScheduleTimes(scheduleId, sched.cron_expr, sched.timezone, new Date());

    logger.info(
      { jobId: job.id, scheduleId, runId, durationMs, slackTs: res.ts, channel: res.channel },
      "Job completed"
    );
    return res;
  } catch (err: any) {
    const durationMs = Date.now() - startedAt;
    await markFailed(runId, { durationMs, error: String(err?.data ?? err?.message ?? err) });

    try {
      const sched = await getScheduleById(scheduleId);
      await bumpScheduleTimes(scheduleId, sched.cron_expr, sched.timezone, new Date());
    } catch (e) {
      logger.warn({ e, scheduleId }, "bumpScheduleTimes on failure failed");
    }

    throw err;
  }
}