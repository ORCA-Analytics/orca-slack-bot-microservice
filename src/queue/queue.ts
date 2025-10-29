import * as IORedisNS from "ioredis";
import { Queue, Worker, type JobsOptions, type Processor } from "bullmq";
import { env } from "@/config/env.js";
import { logger } from "@/utils/logger.js";

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
  
  logger.info({ queueName }, "Worker started and ready to process jobs");
  
  worker.on("failed", (job, err) => {
    logger.error({ jobId: job?.id, queueName, err }, "job failed");
  });
  worker.on("completed", (job) => {
    logger.info({ jobId: job.id, queueName }, "job completed");
  });
  worker.on("stalled", (jobId) => {
    logger.warn({ jobId, queueName }, "job stalled");
  });
  worker.on("error", (err) => {
    logger.error({ queueName, err }, "worker error");
  });
  worker.on("active", (job) => {
    logger.info({ jobId: job.id, queueName }, "job started processing");
  });
  
  return worker;
}

export type EnqueueOpts = JobsOptions;
