import { supabase } from "../clients/supabase.js";
import { logger } from "../utils/logger.js";
export async function logQueued(scheduleId: string) {
  const { data, error } = await supabase
    .from("slack_jobs")
    .insert({ 
      schedule_id: scheduleId,
      status: "pending",
      run_at: new Date().toISOString()
    })
    .select("id")
    .single();
  if (error) {
    logger.error({ error }, "logQueued failed");
    throw error;
  }
  return { runId: data.id as string };
}

export async function markRunning(runId: string) {
  const { error } = await supabase
    .from("slack_jobs")
    .update({ status: "running", started_at: new Date().toISOString() })
    .eq("id", runId);
  if (error) {
    throw error;
  }
}

export async function markCompleted(runId: string, args: { durationMs: number; slackTs: string; slackChannel: string }) {
  const { durationMs, slackTs, slackChannel } = args;
  const { error } = await supabase
    .from("slack_jobs")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
      duration_ms: durationMs,
      slack_ts: slackTs,
      slack_channel: slackChannel,
      error_message: null,
    })
    .eq("id", runId);
  if (error) throw error;
}

export async function markFailed(runId: string, args: { durationMs?: number; error: string }) {
  const { durationMs, error } = args;
  const { error: dbErr } = await supabase
    .from("slack_jobs")
    .update({
      status: "failed",
      completed_at: new Date().toISOString(),
      duration_ms: durationMs ?? null,
      error_message: error,
    })
    .eq("id", runId);
  if (dbErr) throw dbErr;
}

export function nextRunISO(cronExpr: string, timezone: string, from?: Date): string {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const cronParser = require("cron-parser");
  const it = cronParser.CronExpressionParser.parse(cronExpr, { tz: timezone, currentDate: from ?? new Date() });
  return it.next().toDate().toISOString();
}

export async function bumpScheduleTimes(scheduleId: string, cronExpr: string | null, timezone: string | null, asOf: Date) {
  const updates: Record<string, any> = { last_run_at: asOf.toISOString() };
  if (cronExpr && timezone) {
    updates.next_run_at = nextRunISO(cronExpr, timezone, asOf);
  }
  const { error } = await supabase.from("slack_schedules").update(updates).eq("id", scheduleId);
  if (error) throw error;
}
