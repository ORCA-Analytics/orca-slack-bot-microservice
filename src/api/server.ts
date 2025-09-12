import Fastify from "fastify";
import { registry } from "../metrics/metrics.js";
import { authGuard } from "./auth.js";
import { queue } from "@/queue/queue.js";
import { schedulePayloadSchema, executeNowSchema } from "./schemas.js";
import { collectDefaultMetrics } from "prom-client";

export function buildServer() {
  const app = Fastify({ logger: false });

  app.get("/health", async () => ({ ok: true }));
  app.get("/metrics", async (_req, reply) => {
    reply.header("Content-Type", registry.contentType);
    return registry.metrics();
  });

  app.post("/jobs", { preHandler: authGuard }, async (req, reply) => {
    const body = schedulePayloadSchema.parse(req.body);
    const { scheduleId, cron, timezone = "UTC", status = "enabled", payload } = body;

    if (status === "disabled") {
      const reps = await queue.getRepeatableJobs();
      const toRemove = reps.filter((r) => r.id === scheduleId || r.key.includes(`${scheduleId}@`));
      await Promise.all(toRemove.map((r) => queue.removeRepeatableByKey(r.key)));
      return reply.send({ ok: true, removed: toRemove.length });
    }

    if (!cron) return reply.code(400).send({ error: "cron is required when enabling a job" });

    const jobName = `schedule:${scheduleId}`;
    const key = `${scheduleId}@${cron}@${timezone}`;
    await queue.add(jobName, { scheduleId, payload }, {
      repeat: { pattern: cron, tz: timezone },
      jobId: key,
      removeOnComplete: true,
      removeOnFail: false,
    });
    return reply.send({ ok: true, job: { scheduleId, cron, timezone } });
  });

  app.post("/execute-now", { preHandler: authGuard }, async (req, reply) => {
    const body = executeNowSchema.parse(req.body);
    const res = await queue.add("manual-exec", body, { removeOnComplete: true });
    return reply.send({ ok: true, id: res.id });
  });

  return app;
}