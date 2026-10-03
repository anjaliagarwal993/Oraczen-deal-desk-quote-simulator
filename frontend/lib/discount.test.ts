import { describe, expect, it } from "vitest";
import { isDraft, migrateDraft } from "./draft";
import { approvedLabel, fmtPct, negotiationRows, pointsText } from "./discount";

const base = { customer_requested_discount_pct: 18, proposed_discount_pct: 15, difference_percentage_points: 3, tier_max_discount_pct: 20 };

describe("discount negotiation display", () => {
  it("shows requested, proposal, tier max and the difference in percentage points", () => {
    expect(negotiationRows(base)).toEqual([
      { label: "Customer requested", value: "18%" }, { label: "Your proposal", value: "15%" },
      { label: "Tier maximum", value: "20%" }, { label: "Difference", value: "3 percentage points" },
    ]);
  });
  it("updates when the API reports a different request", () => {
    expect(negotiationRows({ ...base, customer_requested_discount_pct: 16, difference_percentage_points: 1 })?.[3].value).toBe("1 percentage point");
    expect(negotiationRows({ ...base, customer_requested_discount_pct: 10, difference_percentage_points: -5 })?.[3].value).toBe("5 percentage points");
  });
  it("hides the box when no request was entered", () => {
    expect(negotiationRows({ ...base, customer_requested_discount_pct: null, difference_percentage_points: null })).toBeNull();
  });
  it("keeps a request above the tier maximum visible (it is only information)", () => {
    expect(negotiationRows({ ...base, customer_requested_discount_pct: 25, difference_percentage_points: 10 })?.[0].value).toBe("25%");
  });
});

describe("approved discount display", () => {
  it("is Pending before approval and a percentage after", () => {
    expect(approvedLabel(null)).toBe("Pending");
    expect(approvedLabel(15)).toBe("15%");
    expect(fmtPct(null)).toBe("Not provided");
    expect(pointsText(0)).toBe("0 percentage points");
  });
});

describe("draft recovery with the new fields", () => {
  const ok = { customer_name: "Acme", seats: 10, lines: [{ sku: "AGENT-CORE", quantity: 1 }], customer_requested_discount_pct: 18, proposed_discount_pct: 15, annual_commitment: false };
  it("accepts a draft with both discount fields", () => expect(isDraft(ok)).toBe(true));
  it("migrates an old draft that only had discount_pct", () => {
    const { customer_requested_discount_pct, proposed_discount_pct, ...rest } = ok;
    const migrated = migrateDraft({ ...rest, discount_pct: 12 });
    expect(isDraft(migrated)).toBe(true);
    expect(migrated).toMatchObject({ proposed_discount_pct: 12, customer_requested_discount_pct: null });
    expect(customer_requested_discount_pct + proposed_discount_pct).toBe(33);
  });
});
