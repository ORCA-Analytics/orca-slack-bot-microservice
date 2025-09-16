import * as IORedisNS from "ioredis";
import { Queue, Worker, type JobsOptions, type Processor } from "bullmq";
import { env } from "../config/env.js";
import { logger } from "../utils/logger.js";

const IORedis: any = (IORedisNS as any).default ?? (IORedisNS as any);
const connection = new IORedis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
});
export const queue = new Queue("slack-jobs", { connection });
export const slackMessageQueue = new Queue("slack-message-exec", { connection });

export function startWorker(processor: Processor, queueName: string = "slack-jobs") {
  const worker = new Worker(queueName, processor, {
    connection,
    concurrency: 5,
    stalledInterval: 30000, 
    maxStalledCount: 1,
    removeOnComplete: { count: 10 },
    removeOnFail: { count: 5 },
  });
  worker.on("failed", (job, err) => {
    logger.error({ jobId: job?.id, err }, "job failed");
  });
  worker.on("completed", (job) => {
    logger.info({ jobId: job.id }, "job completed");
  });
  worker.on("stalled", (jobId) => {
    logger.warn({ jobId }, "job stalled");
  });
  return worker;
}

export type EnqueueOpts = JobsOptions;
