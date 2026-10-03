"""ALL business rules live in this file.

Pure functions: no web framework, no globals. The frontend never calculates;
it sends a draft to the API and displays whatever comes back from here.

Money is integer cents everywhere. Discount percentages are Decimal.
"""
from __future__ import annotations

import json
from decimal import ROUND_HALF_UP, Decimal
from pathlib import Path
from typing import Any

# --- Approval thresholds (from the assignment; not part of catalog.json) ---
APPROVAL_DISCOUNT_PCT = Decimal("15")   # approval if discount is ABOVE this
ANNUAL_DISCOUNT_PCT = Decimal("10")     # with annual commitment, approval if ABOVE this
APPROVAL_TOTAL_CENTS = 25_000 * 100     # approval if total is ABOVE this
MAX_QUANTITY = 100_000                  # sanity cap so a typo can't make a $1B quote

REASON_MESSAGES = {
    "discount_above_15_percent": "Proposed discount is above 15%.",
    "total_above_25000": "Total is above $25,000.",
    "annual_commitment_discount_above_10_percent": (
        "Annual commitment is selected and the proposed discount is above 10%."
    ),
}


class QuoteValidationError(Exception):
    """Carries a list of {field, code, message} so the UI can show all problems at once."""

    def __init__(self, errors: list[dict[str, str]]):
        super().__init__("; ".join(e["message"] for e in errors))
        self.errors = errors


# ---------------------------------------------------------------- helpers
def to_cents(amount: Decimal) -> int:
    return int((amount * 100).quantize(Decimal(1), rounding=ROUND_HALF_UP))


def fmt_money(cents: int) -> str:
    dollars, rem = divmod(abs(cents), 100)
    text = f"${dollars:,}" + (f".{rem:02d}" if rem else "")
    return f"-{text}" if cents < 0 else text


def fmt_pct(pct: Decimal | float | int) -> str:
    return f"{Decimal(str(pct)).normalize():f}"


def apply_discount(subtotal_cents: int, pct: Decimal) -> int:
    """discount_amount = subtotal x pct / 100, rounded half-up to a whole cent. The ONLY rounding step."""
    return int((Decimal(subtotal_cents) * pct / 100).quantize(Decimal(1), rounding=ROUND_HALF_UP))


def points(d: Decimal) -> str:
    return f"{fmt_pct(d)} percentage point{'' if d == 1 else 's'}"


def describe_negotiation(requested: Decimal | None, proposed: Decimal, tier_max: Decimal | int) -> dict[str, Any]:
    """Negotiation information only. Nothing here feeds pricing, validation or approval."""
    if requested is None:
        return {"difference_percentage_points": None, "negotiation_message": None,
                "policy_message": None, "requested_exceeds_tier_max": False}
    diff = requested - proposed
    if diff > 0:
        msg = f"Customer asked for {points(diff)} more than your proposal."
    elif diff == 0:
        msg = "Your proposal matches the customer's request."
    else:
        msg = f"You are offering {points(-diff)} more than the customer requested."
    over = requested > tier_max
    policy = ("Customer requested a discount above the tier limit, but your proposed discount remains within policy."
              if over and proposed <= tier_max else None)
    return {"difference_percentage_points": float(diff), "negotiation_message": msg,
            "policy_message": policy, "requested_exceeds_tier_max": over}


def validate_approved(raw: Any, calc: dict[str, Any]) -> Decimal:
    """Manager-approved discount: 0-100, within the tier maximum, and never above what was proposed."""
    errs: list[dict[str, str]] = []
    pct = Decimal(str(raw))
    proposed = Decimal(str(calc["proposed_discount_pct"]))
    if not pct.is_finite() or pct < 0 or pct > 100:
        errs.append({"field": "approved_discount_pct", "code": "invalid_approved_discount",
                     "message": "Approved discount must be a number between 0 and 100."})
    elif pct > calc["tier_max_discount_pct"]:
        errs.append({"field": "approved_discount_pct", "code": "approved_above_tier_max",
                     "message": f"Approved discount of {fmt_pct(pct)}% is above the {calc['tier_max_discount_pct']}% maximum for the {calc['tier']} tier."})
    elif pct > proposed:
        errs.append({"field": "approved_discount_pct", "code": "approved_above_proposed",
                     "message": f"Approved discount of {fmt_pct(pct)}% cannot be higher than the {fmt_pct(proposed)}% the salesperson proposed."})
    if errs:
        raise QuoteValidationError(errs)
    return pct


def approved_figures(calc: dict[str, Any], pct: Decimal) -> dict[str, int]:
    """Final numbers at the approved discount. The proposed figures in `calc` are left untouched."""
    amount = apply_discount(calc["subtotal_cents"], pct)
    return {"discount_amount_cents": amount, "total_cents": calc["subtotal_cents"] - amount}


# ---------------------------------------------------------------- catalog
def load_catalog(path: str | Path) -> dict[str, Any]:
    """Read catalog.json. Prices become integer cents; tier ranges are read, not hardcoded."""
    raw = json.loads(Path(path).read_text(), parse_float=Decimal)
    return {
        "currency": raw["currency"],
        "products": [
            {
                "sku": p["sku"],
                "name": p["name"],
                "unit_price_cents": to_cents(Decimal(str(p["unit_price"]))),
            }
            for p in raw["products"]
        ],
        "discount_rules": sorted(raw["discount_rules"], key=lambda r: r["min_seats"]),
    }


def find_tier(seats: int, rules: list[dict[str, Any]]) -> dict[str, Any] | None:
    for rule in rules:
        if rule["min_seats"] <= seats <= rule["max_seats"]:
            return rule
    return None


# ---------------------------------------------------------------- calculation
def calculate(draft: dict[str, Any], catalog: dict[str, Any], require_customer: bool = False) -> dict[str, Any]:
    """Validate a draft and return the authoritative calculation.

    Raises QuoteValidationError listing every problem found.
    seats decide the TIER (and so the max discount); line quantity decides the PRICE.
    """
    errors: list[dict[str, str]] = []

    def err(field: str, code: str, message: str) -> None:
        errors.append({"field": field, "code": code, "message": message})

    rules = catalog["discount_rules"]
    products = {p["sku"]: p for p in catalog["products"]}

    if require_customer and not (draft.get("customer_name") or "").strip():
        err("customer_name", "customer_required", "Enter the customer's name.")

    # seats -> tier
    seats = draft.get("seats")
    tier = None
    top_seats = max(r["max_seats"] for r in rules)
    if seats is None:
        err("seats", "invalid_seats", "Enter the number of seats (a whole number, 1 or more).")
    elif seats < 1 or seats > top_seats:
        err("seats", "invalid_seats", f"Seats must be between 1 and {top_seats:,}. You entered {seats:,}.")
    else:
        tier = find_tier(seats, rules)

    # lines (a SKU added twice is merged into one line: quantities add up)
    raw_lines = draft.get("lines") or []
    if not raw_lines:
        err("lines", "no_line_items", "Add at least one product line.")
    merged: dict[str, int] = {}
    for i, line in enumerate(raw_lines):
        sku, qty, n = line.get("sku"), line.get("quantity"), i + 1
        ok = True
        if not sku:
            err(f"lines[{i}].sku", "unknown_sku", f"Select a product for line {n}.")
            ok = False
        elif sku not in products:
            err(f"lines[{i}].sku", "unknown_sku", f"Unknown product '{sku}' on line {n}. Pick one from the catalog.")
            ok = False
        if qty is None or qty <= 0:
            err(f"lines[{i}].quantity", "invalid_quantity", f"Quantity on line {n} must be a whole number greater than 0.")
            ok = False
        elif qty > MAX_QUANTITY:
            err(f"lines[{i}].quantity", "invalid_quantity", f"Quantity on line {n} cannot exceed {MAX_QUANTITY:,}.")
            ok = False
        if ok:
            merged[sku] = merged.get(sku, 0) + qty

    # proposed discount = the discount actually quoted (legacy input name: discount_pct)
    raw_proposed = draft.get("proposed_discount_pct")
    if raw_proposed is None:
        raw_proposed = draft.get("discount_pct", 0)
    pct = Decimal(str(raw_proposed))
    if not pct.is_finite() or pct < 0 or pct > 100:
        err("proposed_discount_pct", "invalid_discount", "Proposed discount must be a number between 0 and 100.")
    elif tier is not None and pct > tier["max_discount_pct"]:
        err(
            "proposed_discount_pct",
            "discount_above_tier_max",
            f"Invalid quote. Your proposed discount of {fmt_pct(pct)}% exceeds the {tier['max_discount_pct']}% maximum "
            f"for the {tier['code']} tier ({tier['min_seats']}-{tier['max_seats']} seats). "
            "Lower the discount or add seats to reach a higher tier.",
        )

    # customer requested discount: optional, information only. It MAY exceed the tier maximum.
    requested = None
    if draft.get("customer_requested_discount_pct") is not None:
        requested = Decimal(str(draft["customer_requested_discount_pct"]))
        if not requested.is_finite() or requested < 0 or requested > 100:
            err("customer_requested_discount_pct", "invalid_requested_discount",
                "Customer requested discount must be a number between 0 and 100.")

    if errors:
        raise QuoteValidationError(errors)
    assert tier is not None

    lines = []
    for sku, qty in merged.items():
        p = products[sku]
        lines.append({
            "sku": sku,
            "name": p["name"],
            "quantity": qty,
            "unit_price_cents": p["unit_price_cents"],
            "line_total_cents": qty * p["unit_price_cents"],
        })
    subtotal = sum(line["line_total_cents"] for line in lines)
    discount_amount = apply_discount(subtotal, pct)
    total = subtotal - discount_amount
    annual = bool(draft.get("annual_commitment"))

    reasons = []
    if pct > APPROVAL_DISCOUNT_PCT:
        reasons.append("discount_above_15_percent")
    if total > APPROVAL_TOTAL_CENTS:
        reasons.append("total_above_25000")
    if annual and pct > ANNUAL_DISCOUNT_PCT:
        reasons.append("annual_commitment_discount_above_10_percent")

    return {
        "tier": tier["code"],
        "tier_max_discount_pct": tier["max_discount_pct"],
        "seats": seats,
        "lines": lines,
        "subtotal_cents": subtotal,
        "customer_requested_discount_pct": None if requested is None else float(requested),
        "proposed_discount_pct": float(pct),
        **describe_negotiation(requested, pct, tier["max_discount_pct"]),
        "discount_amount_cents": discount_amount,
        "total_cents": total,
        "annual_commitment": annual,
        "approval_required": bool(reasons),
        "approval_reasons": reasons,
        "approval_messages": [REASON_MESSAGES[r] for r in reasons],
        "limits": {
            "approval_discount_pct": float(APPROVAL_DISCOUNT_PCT),
            "annual_discount_pct": float(ANNUAL_DISCOUNT_PCT),
            "approval_total_cents": APPROVAL_TOTAL_CENTS,
        },
    }
