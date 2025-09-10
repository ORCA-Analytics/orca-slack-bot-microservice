import { Job } from "bullmq";
import { z } from "zod";
import { logger } from "@/utils/logger.js";
import { postParentAndReplies } from "@/clients/slack.js";
import { getWorkspaceSlackToken } from "@/clients/slack-token.js";

const blocksSchema = z.array(z.any());
const jobDataSchema = z.object({
  scheduleId: z.string(),
  workspaceId: z.string(),
  payload: z.object({
    slack: z.object({
      channel: z.string().optional(),
    }).optional(),
    parentBlocks: blocksSchema,
    replyBlocks: z.array(blocksSchema).optional(),
    parentText: z.string().optional(),
  }),
});

export async function processJob(job: Job) {
  const parsed = jobDataSchema.parse(job.data);
  const { scheduleId, workspaceId, payload } = parsed;

  const token = await getWorkspaceSlackToken(workspaceId);

  const defaultChannel = process.env.SLACK_DEFAULT_CHANNEL;
  const { channel } = payload.slack ?? {};

  const res = await postParentAndReplies({
    token,
    ...(channel && { channel }),
    ...(defaultChannel && { defaultChannel }),
    parentBlocks: payload.parentBlocks,
    ...(payload.replyBlocks && { replyBlocks: payload.replyBlocks }),
    parentText: payload.parentText ?? `Scheduled message for ${scheduleId}`,
  });

  logger.info({ jobId: job.id, scheduleId, workspaceId, res }, "Slack message posted");
  return res;
}
