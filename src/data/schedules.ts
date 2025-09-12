import { supabase } from "../clients/supabase.js";

export type ScheduleRow = {
  id: string;
  workspace_id: string;
  channel_id: string | null;
  channel_name: string | null;
  cron_expr: string | null;
  timezone: string | null;
  status: "active" | "inactive" | string;
  last_run_at?: string | null;
  next_run_at?: string | null;
};

export async function getScheduleById(id: string): Promise<ScheduleRow> {
  const { data, error } = await supabase
    .from("slack_schedules")
    .select("id, workspace_id, channel_id, channel_name, cron_expr, timezone, status, last_run_at, next_run_at")
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error(`Schedule not found: ${id}`);
  if (data.status !== "active") throw new Error(`Schedule ${id} is not active`);
  return data as ScheduleRow;
}
