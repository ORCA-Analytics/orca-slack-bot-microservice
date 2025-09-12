
import { env } from "@/config/env.js";
import { buildServer } from "@/api/server.js";
import { logger } from "@/utils/logger.js";
import { startWorker } from "@/queue/queue.js";
import { processJob } from "@/jobs/processJob.js";

async function main() {
  startWorker(processJob);
  const app = buildServer();
  await app.listen({ port: env.PORT, host: "0.0.0.0" });
  logger.info(`HTTP server listening on :${env.PORT}`);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
