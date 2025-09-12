import { z } from "zod";

const blocks = z.array(z.any());
const viz = z.object({
  imageUrl: z.string().url().optional(),
  html: z.string().optional(),
  fileName: z.string().optional(),
  alt: z.string().optional(),
}).optional();

export const schedulePayloadSchema = z.object({
  scheduleId: z.string().uuid(),
  cron: z.string().optional(),
  timezone: z.string().optional(),
  status: z.enum(["enabled", "disabled"]).optional(),
  payload: z.object({
    parentText: z.string().optional(),
    parentBlocks: blocks,
    replyBlocks: z.array(blocks).optional(),
    visualization: viz,
  }),
});
export type SchedulePayload = z.infer<typeof schedulePayloadSchema>;

export const executeNowSchema = z.object({
  scheduleId: z.string().uuid(),
  payload: z.object({
    parentText: z.string().optional(),
    parentBlocks: blocks,
    replyBlocks: z.array(blocks).optional(),
    visualization: viz,
  }),
});
export type ExecuteNowPayload = z.infer<typeof executeNowSchema>;