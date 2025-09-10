import { z } from "zod";

export const schedulePayloadSchema = z.object({
  scheduleId: z.string(),
  workspaceId: z.string().optional(),
  slack: z.object({
    teamId: z.string().optional(),
    channel: z.string(),
    threadStrategy: z.enum(["parent_then_replies"]).optional(),
  }).optional(),
  cron: z.string().optional(),
  timezone: z.string().optional(),
  status: z.enum(["enabled", "disabled"]).optional(),
  payload: z.any().optional(), // we'll refine later
});

export type SchedulePayload = z.infer<typeof schedulePayloadSchema>;

export const executeNowSchema = z.object({
  scheduleId: z.string(),
  payload: z.any().optional(),
});
export type ExecuteNowPayload = z.infer<typeof executeNowSchema>;
