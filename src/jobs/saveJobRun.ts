import { supabase } from "../clients/supabase.js";
import { logger } from "../utils/logger.js";

type SaveJobArgs = {
  scheduleId: string;
  workspaceId?: string;
  runAt: Date;
  status: "success" | "error";
  durationMs?: number;
  slackTs?: string;
  error?: string;
};

export async function saveJobRun(args: SaveJobArgs) {
  const { scheduleId, workspaceId, runAt, status, durationMs, slackTs, error } = args;
  const { error: dbErr } = await supabase.from("slack_jobs").insert({
    schedule_id: scheduleId,
    workspace_id: workspaceId ?? null,
    run_at: runAt.toISOString(),
    status,
    duration_ms: durationMs ?? null,
    slack_ts: slackTs ?? null,
    error: error ?? null,
  });
  if (dbErr) {
    logger.error({ dbErr }, "failed to save slack_jobs row");
    throw dbErr;
  }
}
