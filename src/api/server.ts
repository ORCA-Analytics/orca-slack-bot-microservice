import Fastify from "fastify";
import { Registry, collectDefaultMetrics } from "prom-client";
import { authGuard } from "./auth.js";
import { queue } from "@/queue/queue.js";
import { schedulePayloadSchema, executeNowSchema } from "./schemas.js";

export function buildServer() {
  const app = Fastify({ logger: false });
  const registry = new Registry();
  collectDefaultMetrics({ register: registry });

  app.get("/health", async () => ({ ok: true }));

  app.get("/metrics", async (_req, reply) => {
    reply.header("Content-Type", registry.contentType);
    return registry.metrics();
  });

  // POST /jobs
  app.post("/jobs", { preHandler: authGuard }, async (req, reply) => {
    const body = schedulePayloadSchema.parse(req.body);
    const { scheduleId, workspaceId, cron, timezone = "UTC", status = "enabled", payload } = body;
  
    const schedulerId = String(scheduleId);
  
    if (status === "disabled") {
      const removed = await queue.removeJobScheduler(schedulerId);
      return reply.send({ ok: true, removed });
    }
  
    if (!cron) {
      return reply.code(400).send({ error: "cron is required when enabling a job" });
    }
  
    await queue.upsertJobScheduler(
      schedulerId,
      { pattern: cron, tz: timezone },
      {
        name: `schedule:${scheduleId}`,
        data: { scheduleId, workspaceId, payload },
        opts: { removeOnComplete: true, removeOnFail: false },
      },
    );
  
    return reply.send({ ok: true, job: { scheduleId, cron, timezone } });
  });

  // POST /execute-now
  app.post("/execute-now", { preHandler: authGuard }, async (req, reply) => {
    const body = executeNowSchema.parse(req.body);
    const { scheduleId, workspaceId, payload } = body;
    const res = await queue.add("manual-exec", { scheduleId, workspaceId, payload }, { removeOnComplete: true });
    return reply.send({ ok: true, id: res.id });
  });

  return app;
}
