import Fastify from "fastify";
import { Registry, collectDefaultMetrics } from "prom-client";

export function buildServer() {
  const app = Fastify({ logger: false });
  const registry = new Registry();
  collectDefaultMetrics({ register: registry });

  app.get("/health", async () => ({ ok: true }));

  app.get("/metrics", async (_req, reply) => {
    reply.header("Content-Type", registry.contentType);
    return registry.metrics();
  });

  return app;
}
