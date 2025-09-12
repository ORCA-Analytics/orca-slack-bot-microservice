import { getBotTokenByWorkspaceId } from "../src/clients/slack-token";
import * as supa from "../src/clients/supabase";

jest.mock("../src/clients/supabase", () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          order: () => ({
            limit: () => ({
              maybeSingle: async () => ({ data: { access_token: "xoxb-TEST", updated_at: new Date().toISOString() }, error: null }),
            }),
          }),
        }),
      }),
    }),
  },
}));

describe("token cache", () => {
  it("returns token and caches", async () => {
    const t1 = await getBotTokenByWorkspaceId("ws-1");
    const t2 = await getBotTokenByWorkspaceId("ws-1");
    expect(t1).toBe("xoxb-TEST");
    expect(t2).toBe("xoxb-TEST");
  });
});
