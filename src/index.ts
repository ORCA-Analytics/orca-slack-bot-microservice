
import { env } from "@/config/env.js";
import { buildServer } from "@/api/server.js";
import { logger } from "@/utils/logger.js";
import { startWorker, slackMessageQueue } from "@/queue/queue.js";
import { processJob } from "@/jobs/processJob.js";
import { processSlackMessageJob } from "@/jobs/processSlackMessageJob.js";
import { getActiveSchedules } from "@/data/schedules.js";

async function recoverActiveJobs() {
  try {
    logger.info("Starting job recovery...");
    const activeSchedules = await getActiveSchedules();
    logger.info({ count: activeSchedules.length }, "Found active schedules");
    
    for (const schedule of activeSchedules) {
      if (!schedule.cron_expr || !schedule.timezone) continue;
      
      const jobName = `schedule:${schedule.id}`;
      const key = `${schedule.id}@${schedule.cron_expr}@${schedule.timezone}`;
      
      await slackMessageQueue.add(jobName, { scheduleId: schedule.id, payload: {} }, {
        repeat: { pattern: schedule.cron_expr, tz: schedule.timezone },
        jobId: key,
        removeOnComplete: true,
        removeOnFail: false,
      });
      
      logger.info({ scheduleId: schedule.id, cron: schedule.cron_expr, timezone: schedule.timezone }, "Recovered job");
    }
    
    logger.info("Job recovery completed");
  } catch (error) {
    logger.error({ error }, "Failed to recover jobs");
  }
}

async function main() {
  startWorker(processJob, "slack-jobs");
  startWorker(processSlackMessageJob, "slack-message-exec");
  
  await recoverActiveJobs();
  
  const app = buildServer();
  await app.listen({ port: env.PORT, host: "0.0.0.0" });
  logger.info(`HTTP server listening on :${env.PORT}`);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
