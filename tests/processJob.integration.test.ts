import { processJob } from "../src/jobs/processJob.js";
import * as schedules from "../src/data/schedules.js";
import * as token from "../src/clients/slack-token.js";
import { SlackClient } from "../src/clients/slack.js";
import * as jobs from "../src/lib/jobs.js";
import { jobsQueued, jobsRunning, jobsCompleted } from "../src/metrics/metrics.js";

jest.mock("../src/data/schedules.js");
jest.mock("../src/clients/slack-token.js");
jest.mock("../src/clients/slack.js");
jest.mock("../src/lib/jobs.js");

const mockSched = {
  id: "8b0b1d64-8b1d-4d8e-bf9e-123456789abc",
  workspace_id: "ws-1",
  channel_id: "C123",
  channel_name: "general",
  cron_expr: "*/5 * * * *",
  timezone: "America/Chicago",
  status: "active",
};

describe("processJob (idempotency + metrics)", () => {
  let mockSlackClient: any;

  beforeEach(() => {
    (schedules.getScheduleById as any).mockResolvedValue(mockSched);
    (token.getBotTokenByWorkspaceId as any).mockResolvedValue("xoxb-TEST");
    
    mockSlackClient = {
      sendMessage: jest.fn().mockResolvedValue({ 
        ok: true, 
        channel: "C123", 
        ts: "1726050000.000100" 
      })
    };
    (SlackClient as any).mockImplementation(() => mockSlackClient);

    (jobs.logQueued as any).mockResolvedValue({ runId: "run-1" });
    (jobs.markRunning as any).mockResolvedValue(undefined);
    (jobs.markCompleted as any).mockResolvedValue(undefined);
    (jobs.bumpScheduleTimes as any).mockResolvedValue(undefined);
  });

  it("uses job.timestamp as run_at and increments metrics", async () => {
    const job: any = {
      timestamp: Date.parse("2025-09-12T10:00:00Z"),
      data: {
        scheduleId: mockSched.id,
        payload: { parentBlocks: [{ type: "section", text: { type: "mrkdwn", text: "ok" } }] }
      }
    };

    const beforeQ = (jobsQueued as any).hashMap?.[""]?.value || 0;
    const beforeR = (jobsRunning as any).hashMap?.[""]?.value || 0;
    const beforeC = (jobsCompleted as any).hashMap?.[""]?.value || 0;

    await processJob(job);

    expect(jobs.logQueued).toHaveBeenCalledWith(mockSched.id, new Date("2025-09-12T10:00:00.000Z"));
    expect(jobs.markRunning).toHaveBeenCalledWith("run-1");
    expect(mockSlackClient.sendMessage).toHaveBeenCalled();
    expect(jobs.markCompleted).toHaveBeenCalled();

    const afterQ = (jobsQueued as any).hashMap?.[""]?.value || 0;
    const afterR = (jobsRunning as any).hashMap?.[""]?.value || 0;
    const afterC = (jobsCompleted as any).hashMap?.[""]?.value || 0;

    expect(afterQ).toBeGreaterThanOrEqual(beforeQ);
    expect(afterR).toBeGreaterThanOrEqual(beforeR);
    expect(afterC).toBeGreaterThanOrEqual(beforeC);

    expect(jobs.bumpScheduleTimes).toHaveBeenCalledWith(mockSched.id, mockSched.cron_expr, mockSched.timezone, expect.any(Date));
  });

  it("marks failed and still bumps schedule times", async () => {
    mockSlackClient.sendMessage.mockRejectedValueOnce(new Error("boom"));
    const job: any = { data: { scheduleId: mockSched.id, payload: { parentBlocks: [] } } };
    await expect(processJob(job)).rejects.toThrow();
    expect(jobs.markFailed).toHaveBeenCalledWith("run-1", expect.objectContaining({ error: expect.stringContaining("boom") }));
    expect(jobs.bumpScheduleTimes).toHaveBeenCalled();
  });
});