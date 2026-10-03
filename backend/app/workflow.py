"""Quote status workflow: draft -> submitted -> approved | rejected. Approved/rejected are final.

`apply_status_change` is pure Python (no web framework) so every approval rule is unit-testable.
"""
from __future__ import annotations

from decimal import Decimal
from typing import Any

from .legacy import normalize_quote
from .pricing import QuoteValidationError, approved_figures, fmt_money, fmt_pct, validate_approved

TRANSITIONS: dict[str, list[str]] = {
    "draft": ["submitted"],
    "submitted": ["approved", "rejected"],
    "approved": [],
    "rejected": [],
}


class InvalidTransition(Exception):
    pass


def allowed_next(status: str) -> list[str]:
    return TRANSITIONS.get(status, [])


def can_transition(current: str, new: str) -> bool:
    return new in allowed_next(current)


def apply_status_change(q: dict[str, Any], new_status: str, approved_pct: Any = None,
                        comment: str | None = None, ts: str = "") -> None:
    """Validate everything first, then mutate `q` and append an audit entry. Raises before any change is made.

    - approved: records the manager-approved discount. If none is given, it is recorded as equal to the proposal
      (stored as its own value, never left implicit).
    - rejected: stores the optional reason in the history.
    """
    current = q["status"]
    if not can_transition(current, new_status):
        nxt = ", ".join(allowed_next(current)) or "none (this status is final)"
        raise InvalidTransition(f"Cannot move a quote from '{current}' to '{new_status}'. Allowed next: {nxt}.")

    nq = normalize_quote(q)
    calc = nq["calculation"]
    proposed = Decimal(str(nq["proposed_discount_pct"]))
    comment = (comment or "").strip() or None
    entry: dict[str, Any] = {"from": current, "to": new_status, "at": ts}

    if new_status == "approved":
        approved = validate_approved(proposed if approved_pct is None else approved_pct, calc)
        figures = approved_figures(calc, approved)
        if approved == proposed:
            entry["note"] = f"Quote approved at the proposed {fmt_pct(proposed)}% discount."
        else:
            entry["note"] = (f"Manager changed approved discount: {fmt_pct(proposed)}% → {fmt_pct(approved)}%. "
                             f"Quote approved. Final total {fmt_money(figures['total_cents'])}.")
        entry["approved_discount_pct"] = float(approved)
        q["approved_discount_pct"], q["approved"] = float(approved), figures
    else:
        if approved_pct is not None:
            raise QuoteValidationError([{"field": "approved_discount_pct", "code": "approved_discount_not_allowed",
                                         "message": "An approved discount can only be recorded when approving a quote."}])
        entry["note"] = "Submitted for approval." if new_status == "submitted" else "Quote rejected."
        if new_status == "rejected" and comment:
            entry["note"] += f" Reason: {comment}"
    if comment:
        entry["comment"] = comment
    q["history"].append(entry)
    q["status"], q["updated_at"] = new_status, ts
