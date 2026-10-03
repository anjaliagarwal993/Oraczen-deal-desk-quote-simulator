"""Business-rule tests. Pure functions, no server needed."""
from decimal import Decimal
from pathlib import Path

import pytest

from app.pricing import QuoteValidationError, calculate, find_tier, load_catalog

CATALOG = load_catalog(Path(__file__).parent.parent / "data" / "catalog.json")


def draft(seats=10, lines=None, discount=0, annual=False):
    return {
        "customer_name": "Acme",
        "seats": seats,
        "lines": lines or [{"sku": "AGENT-CORE", "quantity": 1}],
        "discount_pct": Decimal(str(discount)),
        "annual_commitment": annual,
    }


def codes(exc_info):
    return [e["code"] for e in exc_info.value.errors]


def test_calculation_path_matches_spec_formulas():
    # 100 x $120 = $12,000; 15% = $1,800; total $10,200
    r = calculate(draft(10, [{"sku": "AGENT-CORE", "quantity": 100}], 15), CATALOG)
    assert (r["subtotal_cents"], r["discount_amount_cents"], r["total_cents"]) == (1_200_000, 180_000, 1_020_000)
    assert r["tier"] == "GROWTH"


def test_boundary_seats_9_vs_10_and_49_vs_50():
    tiers = {s: calculate(draft(s), CATALOG)["tier"] for s in (1, 9, 10, 49, 50, 99999)}
    assert tiers == {1: "STARTER", 9: "STARTER", 10: "GROWTH", 49: "GROWTH", 50: "ENTERPRISE", 99999: "ENTERPRISE"}
    assert find_tier(100000, CATALOG["discount_rules"]) is None


def test_invalid_seats_rejected():
    for bad in (0, -5, 100000, None):
        with pytest.raises(QuoteValidationError) as e:
            calculate(draft(bad), CATALOG)
        assert "invalid_seats" in codes(e)


def test_discount_exactly_15_is_not_above_15():
    assert calculate(draft(10, discount=15), CATALOG)["approval_required"] is False
    r = calculate(draft(10, discount="15.01"), CATALOG)
    assert r["approval_reasons"] == ["discount_above_15_percent"]


def test_total_exactly_25000_is_not_above_25000():
    at_limit = calculate(draft(10, [{"sku": "ONBOARDING", "quantity": 10}]), CATALOG)  # $25,000.00
    assert at_limit["total_cents"] == 2_500_000 and at_limit["approval_required"] is False
    over = calculate(draft(10, [{"sku": "ONBOARDING", "quantity": 10}, {"sku": "AGENT-CORE", "quantity": 1}]), CATALOG)
    assert over["approval_reasons"] == ["total_above_25000"]


def test_starter_can_never_trigger_the_15_percent_rule():
    # STARTER max is 10%, so anything that would trigger "above 15%" is rejected as above the tier max.
    with pytest.raises(QuoteValidationError) as e:
        calculate(draft(9, discount=16), CATALOG)
    assert codes(e) == ["discount_above_tier_max"]
    assert "discount_above_15_percent" not in calculate(draft(9, discount=10), CATALOG)["approval_reasons"]


def test_annual_commitment_only_changes_approval_not_price():
    plain = calculate(draft(10, discount=12, annual=False), CATALOG)
    annual = calculate(draft(10, discount=12, annual=True), CATALOG)
    assert plain["total_cents"] == annual["total_cents"]
    assert plain["approval_required"] is False
    assert annual["approval_reasons"] == ["annual_commitment_discount_above_10_percent"]
    assert calculate(draft(10, discount=10, annual=True), CATALOG)["approval_required"] is False  # exactly 10


def test_rounding_is_half_up_in_integer_cents():
    # $120 x 0.0625% = 7.5 cents -> 8 cents (half up), never a float surprise
    r = calculate(draft(5, discount="0.0625"), CATALOG)
    assert r["discount_amount_cents"] == 8 and r["total_cents"] == 11_992


def test_same_product_twice_is_merged():
    r = calculate(draft(10, [{"sku": "AGENT-CORE", "quantity": 2}, {"sku": "AGENT-CORE", "quantity": 3}]), CATALOG)
    assert len(r["lines"]) == 1 and r["lines"][0]["quantity"] == 5


def test_seats_decide_tier_but_quantity_decides_price():
    r = calculate(draft(5, [{"sku": "AGENT-CORE", "quantity": 100}]), CATALOG)
    assert r["tier"] == "STARTER" and r["subtotal_cents"] == 1_200_000


def test_validation_reports_all_problems_at_once():
    with pytest.raises(QuoteValidationError) as e:
        calculate(draft(10, [{"sku": "NOPE", "quantity": 1}, {"sku": "AGENT-CORE", "quantity": 0}], 25), CATALOG)
    assert set(codes(e)) == {"unknown_sku", "invalid_quantity", "discount_above_tier_max"}


def test_no_line_items_rejected():
    with pytest.raises(QuoteValidationError) as e:
        calculate({**draft(), "lines": []}, CATALOG)
    assert codes(e) == ["no_line_items"]


def test_tier_ranges_come_from_the_catalog_not_hardcoded():
    custom = {**CATALOG, "discount_rules": [
        {"code": "SMALL", "min_seats": 1, "max_seats": 4, "max_discount_pct": 5},
        {"code": "BIG", "min_seats": 5, "max_seats": 99999, "max_discount_pct": 50},
    ]}
    assert calculate(draft(5), custom)["tier"] == "BIG"
