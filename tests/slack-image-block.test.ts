import { ensureImageInBlocks } from "../src/clients/slack.js";

describe("ensureImageInBlocks", () => {
  it("appends image block when none exists", () => {
    const base = [{ type: "section", text: { type: "mrkdwn", text: "Hi" } }];
    const out = ensureImageInBlocks(base as any, "https://example.com/test.png", "Test");
    expect(out.length).toBe(2);
    expect(out[1].type).toBe("image");
    expect(out[1].image_url).toBe("https://example.com/test.png");
  });

  it("keeps blocks when image already exists", () => {
    const base = [{ type: "image", image_url: "https://x", alt_text: "x" }];
    const out = ensureImageInBlocks(base as any, "https://y");
    expect(out.length).toBe(1);
    expect(out[0].image_url).toBe("https://x");
  });
});
