import Fastify from "fastify";
import { registry } from "../metrics/metrics.js";
import { authGuard } from "./auth.js";
import { queue, slackMessageQueue } from "@/queue/queue.js";
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
      const reps = await slackMessageQueue.getRepeatableJobs();
      const toRemove = reps.filter((r) => r.id === scheduleId || r.key.includes(`${scheduleId}@`));
      await Promise.all(toRemove.map((r) => slackMessageQueue.removeRepeatableByKey(r.key)));
      return reply.send({ ok: true, removed: toRemove.length });
    }

    if (!cron) return reply.code(400).send({ error: "cron is required when enabling a job" });

    const existing = await slackMessageQueue.getRepeatableJobs();
    const stale = existing.filter((r) => r.id === scheduleId || r.key.includes(`${scheduleId}@`));
    if (stale.length) {
      await Promise.all(stale.map((r) => slackMessageQueue.removeRepeatableByKey(r.key)));
    }

    const jobName = `schedule:${scheduleId}`;
    const key = `${scheduleId}@${cron}@${timezone}`;
    await slackMessageQueue.add(jobName, { scheduleId, payload }, {
      repeat: { pattern: cron, tz: timezone },
      jobId: key,
      removeOnComplete: true,
      removeOnFail: false,
    });
    return reply.send({ ok: true, job: { scheduleId, cron, timezone }, removedOld: stale.length });
  });
  
  app.post("/execute-slack-message", { preHandler: authGuard }, async (req, reply) => {
    const body = executeNowSchema.parse(req.body);
    const res = await slackMessageQueue.add("slack-message-exec", body, { removeOnComplete: true });
    return reply.send({ ok: true, id: res.id });
  });

  app.post("/send-message", { preHandler: authGuard }, async (req, reply) => {
    const body = executeNowSchema.parse(req.body);
    const res = await slackMessageQueue.add("slack-message-exec", body, { removeOnComplete: true });
    return reply.send({ ok: true, id: res.id });
  });

  app.post("/send-message-simple", { preHandler: authGuard }, async (req, reply) => {
    const { messageId } = req.body as { messageId: string };
    
    if (!messageId) {
      return reply.code(400).send({ error: "messageId is required" });
    }

    try {
      const { supabase } = await import("@/clients/supabase.js");
      const { SlackMessageProcessor } = await import("@/lib/slack-message-processor.js");
      
      const { data: message, error: messageError } = await supabase
        .from('slack_messages')
        .select(`
          *,
          slack_templates(
            id,
            name,
            sql_text,
            slack_blocks,
            viz_config_json
          ),
          slack_workspaces!inner(
            id,
            company_id,
            slack_team_id
          )
        `)
        .eq('id', messageId)
        .single();

      if (messageError || !message) {
        return reply.code(404).send({ ok: false, error: `Message not found: ${messageError?.message}` });
      }

      const { data: token, error: tokenError } = await supabase
        .from('slack_tokens')
        .select('access_token')
        .eq('workspace_id', message.slack_workspaces.id)
        .single();

      if (tokenError || !token) {
        return reply.code(404).send({ ok: false, error: `No access token found for workspace: ${tokenError?.message}` });
      }

      const processor = new SlackMessageProcessor();
      const result = await processor.processMessage(message, token.access_token);

      if (!result.success) {
        return reply.code(500).send({ ok: false, error: result.error });
      }

      return reply.send({ 
        ok: true, 
        success: true,
        slack_ts: result.slack_ts,
        channel: result.channel,
        childResults: result.childResults
      });

    } catch (error) {
      return reply.code(500).send({ 
        ok: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  });

  app.post("/test-sql", { preHandler: authGuard }, async (req, reply) => {
    const { sql, companyId } = req.body as { sql: string; companyId: string };
    try {
      const { BigQueryClient } = await import("@/clients/bigquery.js");
      const bigQueryClient = new BigQueryClient();
      const result = await bigQueryClient.executeQuery(sql, companyId);
      return reply.send({ ok: true, result });
    } catch (error) {
      return reply.code(500).send({ ok: false, error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.get("/debug-template/:messageId", { preHandler: authGuard }, async (req, reply) => {
    const { messageId } = req.params as { messageId: string };
    try {
      const { supabase } = await import("@/clients/supabase.js");
      
      const { data: message, error } = await supabase
        .from('slack_messages')
        .select(`
          *,
          slack_templates(
            id,
            name,
            sql_text,
            slack_blocks,
            viz_config_json
          ),
          slack_workspaces!inner(
            id,
            company_id,
            slack_team_id
          )
        `)
        .eq('id', messageId)
        .single();

      if (error || !message) {
        return reply.code(404).send({ ok: false, error: `Message not found: ${error?.message}` });
      }

      return reply.send({ 
        ok: true, 
        message: {
          id: message.id,
          templateId: message.template_id,
          templateName: message.slack_templates.name,
          hasSqlText: !!message.slack_templates.sql_text,
          sqlTextLength: message.slack_templates.sql_text?.length || 0,
          sqlTextPreview: message.slack_templates.sql_text?.substring(0, 200) || null,
          hasSlackBlocks: !!message.slack_templates.slack_blocks,
          slackBlocksCount: message.slack_templates.slack_blocks?.length || 0,
          hasVizConfig: !!message.slack_templates.viz_config_json,
          companyId: message.slack_workspaces.company_id,
          workspaceId: message.slack_workspaces.id
        }
      });
    } catch (error) {
      return reply.code(500).send({ ok: false, error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  return app;
}