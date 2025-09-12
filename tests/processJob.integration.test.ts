import { processJob } from "../src/jobs/processJob";
import * as schedules from "../src/data/schedules";
import * as token from "../src/clients/slack-token";
import * as slack from "../src/clients/slack";
import * as jobs from "../src/lib/jobs";

jest.mock("../src/data/schedules");
jest.mock("../src/clients/slack-token");
jest.mock("../src/clients/slack");
jest.mock("../src/lib/jobs");

const mockSched = {
  id: "8b0b1d64-8b1d-4d8e-bf9e-123456789abc",
  workspace_id: "ws-1",
  channel_id: "C123",
  channel_name: "general",
  cron_expr: "*/5 * * * *",
  timezone: "America/Chicago",
  status: "active",
};

describe("processJob", () => {
  beforeEach(() => {
    (schedules.getScheduleById as any).mockResolvedValue(mockSched);
    (token.getBotTokenByWorkspaceId as any).mockResolvedValue("xoxb-TEST");
    (slack.postParentAndReplies as any).mockResolvedValue({ channel: "C123", ts: "1726050000.000100" });
    (jobs.logQueued as any).mockResolvedValue({ runId: "run-1" });
  });

  it("posts and marks completed, bumps schedule times", async () => {
    const job: any = { data: {
      scheduleId: mockSched.id,
      payload: { parentBlocks: [{ type: "section", text: { type: "mrkdwn", text: "hi" } }] }
    }};
    await processJob(job);
    expect(jobs.markRunning).toHaveBeenCalledWith("run-1");
    expect(slack.postParentAndReplies).toHaveBeenCalled();
    expect(jobs.markCompleted).toHaveBeenCalledWith("run-1", expect.objectContaining({
      slackTs: "1726050000.000100",
      slackChannel: "C123",
    }));
    expect(jobs.bumpScheduleTimes).toHaveBeenCalledWith(mockSched.id, mockSched.cron_expr, mockSched.timezone, expect.any(Date));
  });

  it("marks failed and still bumps schedule times", async () => {
    (slack.postParentAndReplies as any).mockRejectedValueOnce(new Error("boom"));
    const job: any = { data: {
      scheduleId: mockSched.id,
      payload: { parentBlocks: [] }
    }};
    await expect(processJob(job)).rejects.toThrow();
    expect(jobs.markFailed).toHaveBeenCalledWith("run-1", expect.objectContaining({ error: expect.stringContaining("boom") }));
    expect(jobs.bumpScheduleTimes).toHaveBeenCalled();
  });
});
