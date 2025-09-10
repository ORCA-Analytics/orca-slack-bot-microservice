import { env } from "./config/env.js";
import { buildServer } from "./api/server.js";
import { logger } from "./utils/logger.js";

async function main() {
  const app = buildServer();
  await app.listen({ port: env.PORT, host: "0.0.0.0" });
  logger.info(`HTTP server listening on :${env.PORT}`);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
