import { Counter, Registry, collectDefaultMetrics } from "prom-client";

export const registry = new Registry();
collectDefaultMetrics({ register: registry });

export const jobsQueued = new Counter({
  name: "jobs_queued_total",
  help: "Total jobs queued (pending)",
  registers: [registry],
});
export const jobsRunning = new Counter({
  name: "jobs_running_total",
  help: "Total jobs marked running",
  registers: [registry],
});
export const jobsCompleted = new Counter({
  name: "jobs_completed_total",
  help: "Total jobs completed",
  registers: [registry],
});
export const jobsFailed = new Counter({
  name: "jobs_failed_total",
  help: "Total jobs failed",
  registers: [registry],
});
