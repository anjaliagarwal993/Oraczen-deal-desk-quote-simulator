"""Deterministic, human-readable text: pricing explanation, Deal Coach tips, comparison."""
from __future__ import annotations

from decimal import Decimal
from typing import Any

from .pricing import (APPROVAL_DISCOUNT_PCT, APPROVAL_TOTAL_CENTS, REASON_MESSAGES, QuoteValidationError,
                      calculate, fmt_money, fmt_pct, points)


def explain(calc: dict[str, Any]) -> list[str]:
    pct = fmt_pct(calc["proposed_discount_pct"])
    out = [f"{calc['seats']} seats → {calc['tier'].title()} tier → maximum discount {calc['tier_max_discount_pct']}%."]
    for line in calc["lines"]:
        out.append(
            f"{line['name']}: {line['quantity']} × {fmt_money(line['unit_price_cents'])} = {fmt_money(line['line_total_cents'])}."
        )
    if calc.get("customer_requested_discount_pct") is not None:
        out.append(f"Customer requested {fmt_pct(calc['customer_requested_discount_pct'])}%; you proposed {pct}%. "
                   f"{calc['negotiation_message']} The request is for negotiation only and does not change the price.")
    out.append(
        f"Subtotal {fmt_money(calc['subtotal_cents'])} → {pct}% proposed discount "
        f"({fmt_money(calc['discount_amount_cents'])}) → final {fmt_money(calc['total_cents'])}."
    )
    if calc["approval_required"]:
        reasons = [m.rstrip(".") for m in calc["approval_messages"]]
        out.append("Approval required because: " + "; ".join(r[0].lower() + r[1:] for r in reasons) + ".")
    else:
        out.append("No approval required: the proposed discount is 15% or less and the total is $25,000 or less.")
    if calc["annual_commitment"]:
        out.append("Annual commitment does not change the price; it only lowers the discount level that needs approval to above 10%.")
    return out


def coach(draft: dict[str, Any], calc: dict[str, Any], catalog: dict[str, Any]) -> list[str]:
    """Rule-based tips ("Deal Coach"). Every tip is verified by re-running calculate()."""
    tips: list[str] = []
    pct = Decimal(str(calc["proposed_discount_pct"]))

    # 0. Negotiation: how far apart are the customer and the proposal? (information only)
    if calc.get("customer_requested_discount_pct") is not None:
        diff = Decimal(str(calc["difference_percentage_points"]))
        if diff > 0:
            tips.append(f"Customer requested {points(diff)} more than your current proposal.")
        elif diff < 0:
            tips.append(f"You're offering {points(-diff)} more than the customer requested. "
                        "Consider confirming that this concession is commercially justified.")
        if calc.get("policy_message"):
            tips.append(calc["policy_message"])
    if "discount_above_15_percent" in calc["approval_reasons"]:
        tips.append(f"Approval required because the proposed discount exceeds the {fmt_pct(APPROVAL_DISCOUNT_PCT)}% approval threshold.")

    # 1. Would a lower discount remove the approval requirement?
    if calc["approval_required"]:
        target = Decimal(10) if calc["annual_commitment"] else Decimal(15)
        if pct > target:
            try:
                trial = calculate({**draft, "proposed_discount_pct": target}, catalog)
            except QuoteValidationError:
                trial = None
            if trial and not trial["approval_required"]:
                tips.append(f"Lowering the discount to {fmt_pct(target)}% removes the approval requirement.")
            elif trial:
                tips.append(
                    f"Lowering the discount to {fmt_pct(target)}% removes the discount trigger, "
                    "but the quote would still need approval."
                )

    # 2. Close to the next seat tier?
    for rule in catalog["discount_rules"]:
        gap = rule["min_seats"] - calc["seats"]
        if gap > 0:
            if gap <= 5:
                s = "seat" if gap == 1 else "seats"
                tips.append(f"You are {gap} {s} from {rule['code']}, where the maximum discount is {rule['max_discount_pct']}%.")
            break

    # 3. Close to the $ approval limit?
    room = APPROVAL_TOTAL_CENTS - calc["total_cents"]
    if 0 <= room <= APPROVAL_TOTAL_CENTS // 10:
        tips.append(f"Total is {fmt_money(calc['total_cents'])}, only {fmt_money(room)} below the {fmt_money(APPROVAL_TOTAL_CENTS)} approval limit.")
    return tips


def resolutions(draft: dict[str, Any], calc: dict[str, Any], catalog: dict[str, Any]) -> list[dict[str, Any]]:
    """WAYS TO REMOVE APPROVAL: what-if simulations only. Each one re-runs calculate(); nothing is changed or saved.
    `changes` is a patch the salesperson may choose to apply (None = needs a manual change)."""
    if not calc["approval_required"]:
        return []
    have = calc["approval_reasons"]
    pct = Decimal(str(calc["proposed_discount_pct"]))

    def simulate(changes: dict[str, Any]) -> list[str] | None:
        try:
            return calculate({**draft, **changes}, catalog)["approval_reasons"]
        except QuoteValidationError:
            return None

    def option(oid: str, title: str, changes: dict[str, Any] | None, remaining: list[str]) -> dict[str, Any]:
        removed = [r for r in have if r not in remaining]
        if not remaining:
            note = "Approval would no longer be required."
        else:
            note = ("Removes: " + " ".join(REASON_MESSAGES[r] for r in removed)
                    + " Still required because: " + " ".join(REASON_MESSAGES[r] for r in remaining))
        return {"id": oid, "title": title, "description": note, "changes": changes,
                "removed_reasons": removed, "remaining_reasons": remaining, "removes_approval": not remaining}

    out = []
    # 1. lower the proposed discount to the highest value that clears the discount rules
    if "discount_above_15_percent" in have or "annual_commitment_discount_above_10_percent" in have:
        target = Decimal(10) if calc["annual_commitment"] else APPROVAL_DISCOUNT_PCT
        remaining = simulate({"proposed_discount_pct": target}) if target < pct else None
        if remaining is not None and len(remaining) < len(have):
            out.append(option("lower_discount", f"Reduce proposed discount to {fmt_pct(target)}%",
                              {"proposed_discount_pct": float(target)}, remaining))
    # 2. annual commitment
    if "annual_commitment_discount_above_10_percent" in have:
        remaining = simulate({"annual_commitment": False})
        if remaining is not None:
            out.append(option("drop_annual", "Turn off annual commitment", {"annual_commitment": False}, remaining))
    # 3. total (scope): cannot be applied automatically, there is no single right way to trim a quote
    if "total_above_25000" in have:
        over = calc["total_cents"] - APPROVAL_TOTAL_CENTS
        o = option("reduce_total", f"Reduce the total by at least {fmt_money(over)}", None,
                   [r for r in have if r != "total_above_25000"])
        o["description"] += (f" Trim scope or quantities so the total is {fmt_money(APPROVAL_TOTAL_CENTS)} or less. "
                             "This needs a manual change, so there is no one-click apply.")
        out.append(o)
    return out


def explain_approval(q: dict[str, Any]) -> list[str]:
    """Extra sentences for a saved quote once a manager has approved a discount."""
    if q.get("approved_discount_pct") is None:
        return []
    a, c = q["approved"], q["calculation"]
    return [f"Manager approved a {fmt_pct(q['approved_discount_pct'])}% discount ({fmt_money(a['discount_amount_cents'])}), "
            f"so the final approved total is {fmt_money(a['total_cents'])}. The original proposal of "
            f"{fmt_pct(c['proposed_discount_pct'])}% ({fmt_money(c['total_cents'])}) is kept for the record."]


def created_note(calc: dict[str, Any]) -> str:
    req = calc.get("customer_requested_discount_pct")
    prop = f"Proposed discount: {fmt_pct(calc['proposed_discount_pct'])}%."
    return "Quote created. " + (f"Customer requested discount: {fmt_pct(req)}%. " if req is not None else "") + prop


def compare_sentences(a: dict[str, Any], b: dict[str, Any]) -> list[str]:
    """Describe what changed going from scenario A to scenario B (both are saved calculations)."""
    out = []
    d = b["total_cents"] - a["total_cents"]
    out.append("Total is unchanged." if d == 0 else f"{'+' if d > 0 else '-'}{fmt_money(abs(d))} total.")
    if a["proposed_discount_pct"] != b["proposed_discount_pct"]:
        out.append(f"Proposed discount {fmt_pct(a['proposed_discount_pct'])}% → {fmt_pct(b['proposed_discount_pct'])}% ({fmt_money(a['discount_amount_cents'])} → {fmt_money(b['discount_amount_cents'])}).")
    if a["seats"] != b["seats"]:
        out.append(f"Seats {a['seats']} → {b['seats']} ({a['tier']} → {b['tier']}).")
    sa, sb = {l["sku"] for l in a["lines"]}, {l["sku"] for l in b["lines"]}
    if sb - sa:
        out.append("Added: " + ", ".join(sorted(sb - sa)) + ".")
    if sa - sb:
        out.append("Removed: " + ", ".join(sorted(sa - sb)) + ".")
    if a["approval_required"] != b["approval_required"]:
        out.append("Approval now required." if b["approval_required"] else "Approval no longer required.")
    else:
        out.append("Approval required in both scenarios." if b["approval_required"] else "Neither scenario needs approval.")
    return out
