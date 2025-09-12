import { z } from "zod";

export const schedulePayloadSchema = z.object({
  scheduleId: z.string().uuid(),
  cron: z.string().optional(),
  timezone: z.string().optional(),
  status: z.enum(["enabled", "disabled"]).optional(),
  payload: z.object({
    parentText: z.string().optional(),
    parentBlocks: z.array(z.any()),
    replyBlocks: z.array(z.array(z.any())).optional(),
  }),
});

export type SchedulePayload = z.infer<typeof schedulePayloadSchema>;

export const executeNowSchema = z.object({
  scheduleId: z.string().uuid(),
  payload: z.object({
    parentText: z.string().optional(),
    parentBlocks: z.array(z.any()),
    replyBlocks: z.array(z.array(z.any())).optional(),
  }),
});
export type ExecuteNowPayload = z.infer<typeof executeNowSchema>;