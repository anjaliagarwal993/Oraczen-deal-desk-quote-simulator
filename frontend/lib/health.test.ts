import { describe, expect, it } from "vitest";
import { healthCounts, healthOf } from "./health";
import type { Stats } from "./types";

describe("healthOf", () => {
  it("open quote that needs approval -> approval", () => {
    expect(healthOf({ status: "draft", approval_required: true })).toBe("approval");
    expect(healthOf({ status: "submitted", approval_required: true })).toBe("approval");
  });
  it("rejected -> review", () => expect(healthOf({ status: "rejected", approval_required: true })).toBe("review"));
  it("approved or no approval needed -> healthy", () => {
    expect(healthOf({ status: "approved", approval_required: true })).toBe("healthy");
    expect(healthOf({ status: "draft", approval_required: false })).toBe("healthy");
  });
});

describe("healthCounts", () => {
  it("adds up to the quote count", () => {
    const s = { count: 10, by_status: { draft: 3, submitted: 2, approved: 4, rejected: 1 }, value_by_status_cents: {}, needs_approval: 3, recent: [] } as unknown as Stats;
    const c = healthCounts(s);
    expect(c).toEqual({ approval: 3, review: 1, healthy: 6 });
    expect(c.approval + c.review + c.healthy).toBe(s.count);
  });
});
