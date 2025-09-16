import { Job } from "bullmq";
import { logger } from "@/utils/logger.js";
import { SlackMessageProcessor } from "@/lib/slack-message-processor.js";
import type { SlackMessage } from "@/types/index.js";
import { supabase } from "@/clients/supabase.js";
import { slackMessageJobSchema } from "@/api/schemas.js";
import {
  logQueued,
  markRunning,
  markCompleted,
  markFailed,
  bumpScheduleTimes,
} from "@/lib/jobs.js";


export async function processSlackMessageJob(job: Job) {
  console.log(`Slack job started: ${job.id}`);

  const parsed = slackMessageJobSchema.parse(job.data);
  const { scheduleId, payload } = parsed;

  const runAt = new Date(job.timestamp ?? Date.now());
  const { runId } = await logQueued(scheduleId, runAt);

  const startedAt = Date.now();
  try {
    await markRunning(runId);

    const { data: schedule, error: scheduleError } = await supabase
      .from('slack_schedules')
      .select('*')
      .eq('id', scheduleId)
      .single();

    if (scheduleError || !schedule) {
      throw new Error(`Schedule not found: ${scheduleError?.message}`);
    }

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
      .eq('id', payload.messageId || schedule.message_id)
      .single();

    if (messageError || !message) {
      throw new Error(`Message not found: ${messageError?.message}`);
    }

    let childMessages: any[] = [];
    if (message.is_parent) {
      const { data: children, error: childrenError } = await supabase
        .from('slack_messages')
        .select(`
          *,
          slack_templates(
            id,
            name,
            sql_text,
            slack_blocks,
            viz_config_json
          )
        `)
        .eq('parent_message_id', message.id)
        .order('position', { ascending: true });

      if (!childrenError && children) {
        childMessages = children;
      }
    }

    const { data: token, error: tokenError } = await supabase
      .from('slack_tokens')
      .select('access_token')
      .eq('workspace_id', message.slack_workspaces.id)
      .single();

    if (tokenError || !token) {
      throw new Error(`No access token found for workspace: ${tokenError?.message}`);
    }

    const processor = new SlackMessageProcessor();
    const result = await processor.processMessage(message, token.access_token, payload);

    if (!result.success) {
      throw new Error(result.error || 'Failed to process message');
    }

    const childResults: any[] = [];
    if (message.is_parent && childMessages.length > 0) {
      logger.info({ scheduleId, childCount: childMessages.length }, 'Processing child messages');
      
      for (const childMessage of childMessages) {
        try {
          const childResult = await processor.processChildMessage(
            childMessage, 
            token.access_token, 
            result.slack_ts!,
            message.slack_workspaces.company_id
          );
          
          if (childResult.success) {
            childResults.push({
              messageId: childMessage.id,
              slackTs: childResult.slack_ts,
              success: true
            });

            try {
              await supabase
                .from('slack_messages')
                .update({ status: 'sent' })
                .eq('id', childMessage.id);
            } catch (error) {
              logger.warn({ error, messageId: childMessage.id }, 'Failed to update child message status');
            }
          } else {
            logger.error({ error: childResult.error, messageId: childMessage.id }, 'Child message send error');
            childResults.push({
              messageId: childMessage.id,
              success: false,
              error: childResult.error
            });
          }
          
        } catch (error) {
          logger.error({ error, messageId: childMessage.id }, 'Error processing child message');
          childResults.push({
            messageId: childMessage.id,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }
    }

    try {
      const { error: updateError } = await supabase
        .from('slack_messages')
        .update({ 
          status: 'sent'
        })
        .eq('id', message.id);

      if (updateError) {
        logger.warn({ error: updateError, messageId: message.id }, 'Failed to update message status');
      }
    } catch (updateError) {
      logger.warn({ error: updateError, messageId: message.id }, 'Failed to update message');
    }

    try {
      const { error: jobError } = await supabase
        .from('slack_jobs')
        .insert({
          status: 'completed',
          slack_ts: result.slack_ts,
          slack_channel: result.channel,
        });

      if (jobError) {
        logger.warn({ error: jobError }, 'Failed to create job record');
      }
    } catch (jobError) {
      logger.warn({ error: jobError }, 'Failed to create job record');
    }

    const durationMs = Date.now() - startedAt;
     await markCompleted(runId, { 
       durationMs, 
       slackTs: result.slack_ts || '', 
       slackChannel: result.channel || '', 
       messageId: message.id 
     });
    await bumpScheduleTimes(scheduleId, schedule.cron_expr, schedule.timezone, new Date());

    logger.info({ 
      jobId: job.id, 
      scheduleId, 
      runId, 
      durationMs, 
      slackTs: result.slack_ts, 
      channel: result.channel, 
      messageId: message.id,
      childCount: childResults.length,
      childSuccessCount: childResults.filter(r => r.success).length
    }, 'Slack message job completed successfully');

    return {
      success: true,
      slack_ts: result.slack_ts,
      channel: result.channel,
      childResults: childResults,
      childCount: childResults.length,
      childSuccessCount: childResults.filter(r => r.success).length
    };

  } catch (err: any) {
    const durationMs = Date.now() - startedAt;
    await markFailed(runId, { durationMs, error: String(err?.data ?? err?.message ?? err) });
    try {
      const { data: sched } = await supabase
        .from('slack_schedules')
        .select('cron_expr, timezone')
        .eq('id', scheduleId)
        .single();
      
      if (sched) {
        await bumpScheduleTimes(scheduleId, sched.cron_expr, sched.timezone, new Date());
      }
    } catch {}
    throw err;
  }
}
