import { ensureImageInBlocks } from "../src/clients/slack.js";
import type { SlackBlock } from "../src/types/index.js";

describe("ensureImageInBlocks", () => {
  it("appends image block when none exists", () => {
    const base: SlackBlock[] = [{ 
      type: "section", 
      text: { type: "mrkdwn", text: "Hi" } 
    }];
    const out = ensureImageInBlocks(base, "https://example.com/test.png", "Test");
    
    expect(out.length).toBe(2);
    expect(out[1].type).toBe("image");
    expect(out[1].image_url).toBe("https://example.com/test.png");
    expect(out[1].alt_text).toBe("Test");
  });

  it("keeps blocks when image already exists", () => {
    const base: SlackBlock[] = [{ 
      type: "image", 
      image_url: "https://x", 
      alt_text: "x" 
    }];
    const out = ensureImageInBlocks(base, "https://y");
    
    expect(out.length).toBe(1);
    expect(out[0].image_url).toBe("https://x");
    expect(out[0].alt_text).toBe("x");
  });

  it("uses default alt text when none provided", () => {
    const base: SlackBlock[] = [{ 
      type: "section", 
      text: { type: "mrkdwn", text: "Hello" } 
    }];
    const out = ensureImageInBlocks(base, "https://example.com/img.png");
    
    expect(out.length).toBe(2);
    expect(out[1].alt_text).toBe("Visualization");
  });

  it("handles empty blocks array", () => {
    const base: SlackBlock[] = [];
    const out = ensureImageInBlocks(base, "https://example.com/img.png", "Test");
    
    expect(out.length).toBe(1);
    expect(out[0].type).toBe("image");
    expect(out[0].image_url).toBe("https://example.com/img.png");
  });

  it("handles multiple image blocks correctly", () => {
    const base: SlackBlock[] = [
      { type: "image", image_url: "https://first.com/img.png", alt_text: "First" },
      { type: "image", image_url: "https://second.com/img.png", alt_text: "Second" }
    ];
    const out = ensureImageInBlocks(base, "https://new.com/img.png", "New");
    
    expect(out.length).toBe(2);
    expect(out[0].image_url).toBe("https://first.com/img.png");
    expect(out[1].image_url).toBe("https://second.com/img.png");
  });
});
