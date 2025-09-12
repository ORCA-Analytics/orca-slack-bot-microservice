import { nextRunISO } from "../src/lib/jobs.js";

describe("nextRunISO", () => {
  it("computes next run in timezone", () => {
    const from = new Date("2025-09-10T12:00:00Z");
    const iso = nextRunISO("0 11 * * MON,THU", "America/Chicago", from);
    expect(typeof iso).toBe("string");
    expect(iso.length).toBeGreaterThan(10);
  });
});
