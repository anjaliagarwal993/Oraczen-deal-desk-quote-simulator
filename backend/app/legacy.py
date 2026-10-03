"""Backward compatibility for quotes saved before the discount negotiation fields existed.

Old records only have `discount_pct`. That value always meant "the discount that was quoted", which is exactly
what `proposed_discount_pct` means now, so it is mapped across when a quote is READ. Nothing is rewritten on disk
and nothing becomes invalid. Old quotes have no customer request and no approved discount (shown as "not recorded").
"""
from __future__ import annotations

from typing import Any


def normalize_quote(raw: dict[str, Any]) -> dict[str, Any]:
    q = dict(raw)
    calc = dict(q["calculation"])
    proposed = q.get("proposed_discount_pct", q.get("discount_pct", calc.get("proposed_discount_pct", calc.get("discount_pct", 0))))
    q["proposed_discount_pct"] = proposed
    q.pop("discount_pct", None)  # one discount value, not two that could disagree
    calc["proposed_discount_pct"] = calc.get("proposed_discount_pct", calc.get("discount_pct", proposed))
    calc.pop("discount_pct", None)
    for key, default in (("customer_requested_discount_pct", None), ("difference_percentage_points", None),
                         ("negotiation_message", None), ("policy_message", None), ("requested_exceeds_tier_max", False)):
        calc.setdefault(key, default)
    q["calculation"] = calc
    q.setdefault("customer_requested_discount_pct", calc["customer_requested_discount_pct"])
    q.setdefault("approved_discount_pct", None)
    q.setdefault("approved", None)
    return q
