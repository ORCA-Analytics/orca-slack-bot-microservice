
import { env } from "@/config/env.js";
import { buildServer } from "@/api/server.js";
import { logger } from "@/utils/logger.js";
import { startWorker } from "@/queue/queue.js";
import { processJob } from "@/jobs/processJob.js";
import { processSlackMessageJob } from "@/jobs/processSlackMessageJob.js";

async function main() {
  startWorker(processJob, "slack-jobs");
  startWorker(processSlackMessageJob, "slack-message-exec");
  
  const app = buildServer();
  await app.listen({ port: env.PORT, host: "0.0.0.0" });
  logger.info(`HTTP server listening on :${env.PORT}`);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
