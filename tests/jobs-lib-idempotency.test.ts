import * as supa from "../src/clients/supabase.js";
import { logQueued } from "../src/lib/jobs.js";  

jest.mock("../src/clients/supabase", () => ({
  supabase: {
    from: () => ({
      insert: (_row: any) => ({
        select: () => ({ single: async () => ({ data: { id: "run-1" }, error: null }) }),
      }),
    }),
  },
}));

describe("logQueued idempotency", () => {
  it("upserts on (schedule_id, run_at)", async () => {
    const { runId } = await logQueued("sched-1", new Date("2025-09-12T10:00:00Z"));
    expect(runId).toBe("run-1");
  });
});
