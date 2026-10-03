import { describe, expect, it } from "vitest";
import { isDraft } from "./draft";
import { formatMoney } from "./format";

describe("formatMoney", () => {
  it("shows whole dollars without cents", () => expect(formatMoney(1_020_000)).toBe("$10,200"));
  it("shows cents when needed", () => expect(formatMoney(11_992)).toBe("$119.92"));
});

describe("isDraft (draft recovery guard)", () => {
  const ok = { customer_name: "Acme", seats: 10, lines: [{ sku: "AGENT-CORE", quantity: 1 }], customer_requested_discount_pct: null, proposed_discount_pct: 0, annual_commitment: false };
  it("accepts a valid draft", () => expect(isDraft(ok)).toBe(true));
  it("accepts null seats/quantity (mid-typing)", () =>
    expect(isDraft({ ...ok, seats: null, lines: [{ sku: "", quantity: null }] })).toBe(true));
  it("rejects corrupted data", () => {
    expect(isDraft({ ...ok, lines: "nope" })).toBe(false);
    expect(isDraft(null)).toBe(false);
  });
});
