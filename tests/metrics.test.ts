import { registry, jobsQueued, jobsRunning, jobsCompleted, jobsFailed } from "../src/metrics/metrics.js";

describe("Prometheus metrics", () => {
  it("should have all counters registered", async () => {
    const metrics = await registry.metrics();
    
    expect(metrics).toContain("jobs_queued_total");
    expect(metrics).toContain("jobs_running_total");
    expect(metrics).toContain("jobs_completed_total");
    expect(metrics).toContain("jobs_failed_total");
  });

  it("should increment counters", async () => {
    jobsQueued.inc();
    jobsRunning.inc();
    jobsCompleted.inc();
    jobsFailed.inc();

    const metrics = await registry.metrics();
    
    expect(metrics).toContain("jobs_queued_total 1");
    expect(metrics).toContain("jobs_running_total 1");
    expect(metrics).toContain("jobs_completed_total 1");
    expect(metrics).toContain("jobs_failed_total 1");
  });
});
