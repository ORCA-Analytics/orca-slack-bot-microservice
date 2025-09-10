import { supabase } from "./supabase.js";

type Cached = { token: string; expireAt?: number };
const cache = new Map<string, Cached>();
const TTL_MS = 60_000;

export async function getWorkspaceSlackToken(workspaceId: string): Promise<string> {
  const now = Date.now();
  const c = cache.get(workspaceId);
  if (c && (!c.expireAt || c.expireAt > now)) return c.token;

  const { data, error } = await supabase
    .from("slack_tokens")
    .select("access_token, expires_at, updated_at")
    .eq("workspace_id", workspaceId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!data?.access_token) throw new Error(`No Slack token for workspace ${workspaceId}`);

  const expireAt = data.expires_at ? new Date(data.expires_at).getTime() : now + TTL_MS;
  cache.set(workspaceId, { token: data.access_token, expireAt: Math.min(expireAt, now + TTL_MS) });

  return data.access_token;
}
