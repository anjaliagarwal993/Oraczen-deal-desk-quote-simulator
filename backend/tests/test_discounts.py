"""Requested vs proposed vs tier-max vs approved discount. Pure logic: no web server needed."""
import copy
from decimal import Decimal
from pathlib import Path

import pytest

from app.explain import coach, created_note, explain, explain_approval, resolutions
from app.legacy import normalize_quote
from app.pricing import QuoteValidationError, approved_figures, calculate, load_catalog, validate_approved
from app.workflow import InvalidTransition, apply_status_change

CATALOG = load_catalog(Path(__file__).parent.parent / "data" / "catalog.json")
ONBOARDING = {"sku": "ONBOARDING", "quantity": 4}          # 4 x $2,500 = $10,000 subtotal


def draft(seats=10, req=None, prop=0, annual=False, lines=None):
    return {"customer_name": "TCS", "seats": seats, "customer_requested_discount_pct": req,
            "proposed_discount_pct": prop, "annual_commitment": annual, "lines": lines or [ONBOARDING]}


def calc(**kw):
    return calculate(draft(**kw), CATALOG)


def codes(fn):
    with pytest.raises(QuoteValidationError) as e:
        fn()
    return [x["code"] for x in e.value.errors]


# ------------------------------------------------------------ difference + wording (edge cases 1, 2, 3, 15, 16)
def test_requested_greater_than_proposed():                       # case 1
    r = calc(req=18, prop=15)
    assert r["difference_percentage_points"] == 3
    assert r["negotiation_message"] == "Customer asked for 3 percentage points more than your proposal."


def test_requested_equals_proposed():                             # case 2
    r = calc(req=18, prop=18)
    assert r["difference_percentage_points"] == 0
    assert r["negotiation_message"] == "Your proposal matches the customer's request."


def test_proposed_greater_than_requested():                       # cases 3 and 15
    assert calc(req=10, prop=15)["negotiation_message"] == "You are offering 5 percentage points more than the customer requested."
    r = calc(req=5, prop=15)
    assert r["difference_percentage_points"] == -10
    assert "offering 10 percentage points more" in r["negotiation_message"]


def test_one_percentage_point_is_singular_and_decimals_work():
    assert calc(req=16, prop=15)["negotiation_message"] == "Customer asked for 1 percentage point more than your proposal."
    r = calc(req="17.25", prop="12.5")
    assert r["difference_percentage_points"] == 4.75 and "4.75 percentage points" in r["negotiation_message"]


def test_zero_requested_and_zero_proposed_is_valid():             # case 16
    r = calc(req=0, prop=0)
    assert r["total_cents"] == 1_000_000 and not r["approval_required"]
    assert r["negotiation_message"] == "Your proposal matches the customer's request."


def test_request_is_optional():
    r = calc(req=None, prop=10)
    assert r["customer_requested_discount_pct"] is None and r["difference_percentage_points"] is None


# ------------------------------------------------------------ requested never touches money or approval
def test_requested_discount_does_not_affect_total():
    totals = {calc(req=r, prop=15)["total_cents"] for r in (None, 0, 15, 20, 90)}
    assert totals == {850_000}                                     # $10,000 - 15% = $8,500, whatever was asked


def test_proposed_discount_drives_the_total():
    assert calc(req=20, prop=15)["discount_amount_cents"] == 150_000
    assert calc(req=20, prop=15)["total_cents"] == 850_000
    assert calc(req=20, prop=10)["total_cents"] == 900_000


def test_approval_ignores_the_request():
    assert not calc(seats=10, req=20, prop=12)["approval_required"]                 # asked 20, proposing 12
    assert calc(seats=10, req=12, prop=18)["approval_reasons"] == ["discount_above_15_percent"]
    assert not calc(seats=10, req=25, prop=15)["approval_required"]                 # exactly 15 is not above 15
    assert calc(seats=10, req=25, prop=18)["approval_required"]
    assert not calc(seats=50, req=100, prop=0)["approval_required"]                 # a huge ask alone never triggers it


# ------------------------------------------------------------ tier maximum applies to the PROPOSED discount
def test_tier_maximum_boundaries():                                # cases 9, 10, 11 + the other tiers
    for seats, top in ((9, 10), (10, 20), (50, 30)):
        assert calc(seats=seats, prop=top)["proposed_discount_pct"] == top
        assert codes(lambda: calc(seats=seats, prop=Decimal(top) + Decimal("0.01"))) == ["discount_above_tier_max"]


def test_invalid_proposed_message_is_clear():
    with pytest.raises(QuoteValidationError) as e:
        calc(seats=10, prop="20.01")
    assert e.value.errors[0]["message"].startswith("Invalid quote. Your proposed discount of 20.01% exceeds the 20% maximum")


def test_requested_may_exceed_tier_max_without_invalidating_the_quote():   # cases 4, 10, 14
    r = calc(seats=10, req=25, prop=18)
    assert r["requested_exceeds_tier_max"] and r["tier_max_discount_pct"] == 20
    assert r["policy_message"] == "Customer requested a discount above the tier limit, but your proposed discount remains within policy."
    assert calc(seats=10, req=25, prop=20)["total_cents"] == 800_000
    r = calc(seats=50, req=35, prop=30)
    assert r["requested_exceeds_tier_max"] and r["total_cents"] == 700_000


def test_requested_within_tier_has_no_policy_message():
    assert calc(seats=10, req=20, prop=20)["policy_message"] is None                 # case 9


def test_high_proposals_are_valid_but_need_approval():            # cases 12, 13
    assert calc(seats=50, req=30, prop=25)["approval_reasons"] == ["discount_above_15_percent"]
    assert calc(seats=50, req=30, prop=30)["approval_required"]


# ------------------------------------------------------------ annual commitment (cases 6, 7, 8, 18)
def test_annual_commitment_rules():
    assert not calc(req=10, prop=10, annual=True)["approval_required"]               # exactly 10
    assert calc(req=12, prop=12, annual=True)["approval_reasons"] == ["annual_commitment_discount_above_10_percent"]
    assert not calc(req=12, prop=12, annual=False)["approval_required"]
    assert calc(prop="10.01", annual=True)["approval_required"]
    r = calc(req=18, prop=15, annual=True)                                           # 15 is not above 15, annual rule fires
    assert r["approval_reasons"] == ["annual_commitment_discount_above_10_percent"]
    assert r["total_cents"] == calc(req=18, prop=15)["total_cents"]                  # annual never changes the price


# ------------------------------------------------------------ total rule + every reason (case 17)
def test_total_over_25000_with_a_request():
    big = [{"sku": "AGENT-AUTOMATE", "quantity": 200}]                              # 200 x $150 = $30,000
    r = calc(seats=10, req=18, prop=15, lines=big)
    assert (r["subtotal_cents"], r["total_cents"]) == (3_000_000, 2_550_000)
    assert r["approval_reasons"] == ["total_above_25000"]


def test_all_applicable_reasons_are_collected():
    r = calc(seats=50, req=25, prop=18, annual=True, lines=[{"sku": "AGENT-AUTOMATE", "quantity": 300}])  # $45,000 -> $36,900
    assert r["approval_reasons"] == ["discount_above_15_percent", "total_above_25000",
                                     "annual_commitment_discount_above_10_percent"]
    assert len(r["approval_messages"]) == 3


# ------------------------------------------------------------ validation
def test_negative_and_over_100_values_are_rejected():
    assert codes(lambda: calc(prop=-1)) == ["invalid_discount"]
    assert codes(lambda: calc(prop=101)) == ["invalid_discount"]
    assert codes(lambda: calc(req=-1, prop=5)) == ["invalid_requested_discount"]
    assert codes(lambda: calc(req=100.5, prop=5)) == ["invalid_requested_discount"]
    assert calc(req=100, prop=5)["customer_requested_discount_pct"] == 100            # boundary: 100 is allowed


def test_legacy_discount_pct_input_still_means_proposed():
    r = calculate({"seats": 10, "lines": [ONBOARDING], "discount_pct": 12}, CATALOG)
    assert r["proposed_discount_pct"] == 12 and r["total_cents"] == 880_000


# ------------------------------------------------------------ approved discount
def test_approved_discount_calculation_keeps_the_proposal():
    r = calc(seats=15, req=22, prop=18)                                               # the example from the brief
    assert r["discount_amount_cents"] == 180_000 and r["total_cents"] == 820_000
    f = approved_figures(r, Decimal(15))
    assert f == {"discount_amount_cents": 150_000, "total_cents": 850_000}
    assert r["proposed_discount_pct"] == 18 and r["total_cents"] == 820_000           # untouched


def test_approved_discount_validation():
    r = calc(seats=15, req=22, prop=18)
    assert validate_approved(15, r) == 15 and validate_approved(18, r) == 18 and validate_approved(0, r) == 0
    assert codes(lambda: validate_approved("18.01", r)) == ["approved_above_proposed"]
    assert codes(lambda: validate_approved(-1, r)) == ["invalid_approved_discount"]
    assert codes(lambda: validate_approved(101, r)) == ["invalid_approved_discount"]
    assert codes(lambda: validate_approved(25, r)) == ["approved_above_tier_max"]


def make_quote(**kw):
    c = calc(**kw)
    return {"id": "Q-1", "status": "draft", "customer_name": "TCS", "seats": c["seats"],
            "customer_requested_discount_pct": c["customer_requested_discount_pct"],
            "proposed_discount_pct": c["proposed_discount_pct"], "approved_discount_pct": None, "approved": None,
            "history": [{"from": None, "to": "draft", "at": "t0", "note": created_note(c)}], "calculation": c}


def test_approval_workflow_records_approved_discount_and_history():
    q = make_quote(seats=15, req=22, prop=18)
    assert "Customer requested discount: 22%" in q["history"][0]["note"]
    apply_status_change(q, "submitted", ts="t1")
    assert q["approved_discount_pct"] is None                                          # "Pending"
    apply_status_change(q, "approved", approved_pct=Decimal(15), comment="ok for TCS", ts="t2")
    assert q["status"] == "approved" and q["approved_discount_pct"] == 15 and q["approved"]["total_cents"] == 850_000
    assert q["proposed_discount_pct"] == 18 and q["calculation"]["total_cents"] == 820_000
    notes = [h["note"] for h in q["history"]]
    assert notes[1] == "Submitted for approval." and "18% → 15%" in notes[2] and q["history"][2]["comment"] == "ok for TCS"
    assert "final approved total is $8,500" in explain_approval(normalize_quote(q))[0]


def test_approving_without_a_value_records_the_proposal_explicitly():
    q = make_quote(seats=15, prop=18)
    apply_status_change(q, "submitted", ts="t1")
    apply_status_change(q, "approved", ts="t2")
    assert q["approved_discount_pct"] == 18 and "at the proposed 18% discount" in q["history"][-1]["note"]


def test_rejection_stores_the_reason_in_history():
    q = make_quote(seats=15, prop=18)
    apply_status_change(q, "submitted", ts="t1")
    apply_status_change(q, "rejected", comment="  Discount is too high for this customer segment.  ", ts="t2")
    assert q["status"] == "rejected" and q["approved_discount_pct"] is None
    assert q["history"][-1]["comment"] == "Discount is too high for this customer segment."
    assert "Reason: Discount is too high" in q["history"][-1]["note"]


def test_invalid_approvals_change_nothing():
    q = make_quote(seats=15, prop=15)
    apply_status_change(q, "submitted", ts="t1")
    before = copy.deepcopy(q)
    assert codes(lambda: apply_status_change(q, "approved", approved_pct=18, ts="t2")) == ["approved_above_proposed"]
    assert codes(lambda: apply_status_change(q, "rejected", approved_pct=10, ts="t2")) == ["approved_discount_not_allowed"]
    assert q == before                                                                  # validated before any mutation
    with pytest.raises(InvalidTransition):
        apply_status_change(make_quote(), "approved", ts="t")                           # draft -> approved is blocked


# ------------------------------------------------------------ backward compatibility
def test_old_quotes_with_only_discount_pct_load_safely():
    old = make_quote(seats=10, prop=12)
    old["discount_pct"] = old.pop("proposed_discount_pct")
    for k in ("customer_requested_discount_pct", "approved_discount_pct", "approved"):
        old.pop(k)
    old["calculation"]["discount_pct"] = old["calculation"].pop("proposed_discount_pct")
    for k in ("customer_requested_discount_pct", "difference_percentage_points", "negotiation_message",
              "policy_message", "requested_exceeds_tier_max"):
        old["calculation"].pop(k)
    n = normalize_quote(old)
    assert n["proposed_discount_pct"] == 12 and n["calculation"]["proposed_discount_pct"] == 12
    assert "discount_pct" not in n and n["customer_requested_discount_pct"] is None and n["approved_discount_pct"] is None
    assert explain(n["calculation"])                                                   # downstream code works on it
    apply_status_change(old, "submitted", ts="t1")                                     # and the workflow accepts it
    assert normalize_quote(normalize_quote(old))["proposed_discount_pct"] == 12        # idempotent


# ------------------------------------------------------------ Deal Coach + what-if
def test_deal_coach_negotiation_tips():
    d = draft(seats=10, req=20, prop=15)
    assert "Customer requested 5 percentage points more than your current proposal." in coach(d, calculate(d, CATALOG), CATALOG)
    d = draft(seats=10, req=10, prop=15)
    tips = coach(d, calculate(d, CATALOG), CATALOG)
    assert any("offering 5 percentage points more" in t and "commercially justified" in t for t in tips)
    d = draft(seats=10, req=25, prop=18)
    tips = coach(d, calculate(d, CATALOG), CATALOG)
    assert any("above the tier limit" in t for t in tips)
    assert "Approval required because the proposed discount exceeds the 15% approval threshold." in tips


def test_ways_to_remove_approval_are_simulations_only():
    d = draft(seats=15, req=22, prop=18)
    original = copy.deepcopy(d)
    r = calculate(d, CATALOG)
    opts = {o["id"]: o for o in resolutions(d, r, CATALOG)}
    assert opts["lower_discount"]["changes"] == {"proposed_discount_pct": 15.0} and opts["lower_discount"]["removes_approval"]
    assert d == original and r["proposed_discount_pct"] == 18                          # nothing was changed


def test_annual_and_total_resolutions():
    d = draft(seats=10, prop=12, annual=True)
    opts = {o["id"]: o for o in resolutions(d, calculate(d, CATALOG), CATALOG)}
    assert opts["lower_discount"]["changes"] == {"proposed_discount_pct": 10.0}
    assert opts["drop_annual"]["changes"] == {"annual_commitment": False} and opts["drop_annual"]["removes_approval"]
    d = draft(seats=10, prop=0, lines=[{"sku": "AGENT-AUTOMATE", "quantity": 200}])
    (o,) = resolutions(d, calculate(d, CATALOG), CATALOG)
    assert o["id"] == "reduce_total" and o["changes"] is None and "$5,000" in o["title"]
    assert resolutions(draft(prop=5), calc(prop=5), CATALOG) == []                     # nothing to resolve
