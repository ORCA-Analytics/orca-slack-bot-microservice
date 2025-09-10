import { Job } from "bullmq";
import { logger } from "@/utils/logger.js";

export async function processJob(job: Job) {
  logger.info({ jobId: job.id, name: job.name, data: job.data }, "processing job");
  return { ok: true };
}
