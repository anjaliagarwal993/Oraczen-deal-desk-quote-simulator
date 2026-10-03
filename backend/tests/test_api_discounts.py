"""HTTP-level tests for the discount negotiation + approval workflow (requires fastapi/httpx installed)."""
import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.main import create_app

CATALOG = Path(__file__).parent.parent / "data" / "catalog.json"
BODY = {"customer_name": "TCS", "seats": 15, "annual_commitment": False,
        "customer_requested_discount_pct": 22, "proposed_discount_pct": 18,
        "lines": [{"sku": "ONBOARDING", "quantity": 4}]}                       # subtotal $10,000


def authed(app):
    c = TestClient(app)
    creds = {"email": "mgr@acme.com", "password": "password123"}
    r = c.post("/api/auth/register", json={"name": "Mgr", **creds})
    if r.status_code == 409:
        r = c.post("/api/auth/login", json=creds)
    c.headers["Authorization"] = f"Bearer {r.json()['token']}"
    return c


@pytest.fixture
def client(tmp_path):
    return authed(create_app(CATALOG, tmp_path / "quotes.json"))


def test_calculate_returns_negotiation_fields_and_resolutions(client):
    r = client.post("/api/quotes/calculate", json=BODY).json()
    assert r["customer_requested_discount_pct"] == 22 and r["proposed_discount_pct"] == 18
    assert r["difference_percentage_points"] == 4 and r["tier"] == "GROWTH" and r["tier_max_discount_pct"] == 20
    assert (r["subtotal_cents"], r["discount_amount_cents"], r["total_cents"]) == (1_000_000, 180_000, 820_000)
    assert r["approval_reasons"] == ["discount_above_15_percent"] and "discount_pct" not in r
    assert r["resolutions"][0]["id"] == "lower_discount" and r["resolutions"][0]["changes"] == {"proposed_discount_pct": 15.0}


def test_calculate_rejects_proposed_above_tier_max_but_allows_high_request(client):
    bad = client.post("/api/quotes/calculate", json={**BODY, "proposed_discount_pct": 20.01})
    assert bad.status_code == 422 and bad.json()["errors"][0]["code"] == "discount_above_tier_max"
    assert bad.json()["errors"][0]["field"] == "proposed_discount_pct"
    ok = client.post("/api/quotes/calculate", json={**BODY, "customer_requested_discount_pct": 99, "proposed_discount_pct": 20})
    assert ok.status_code == 200 and ok.json()["requested_exceeds_tier_max"] is True
    over = client.post("/api/quotes/calculate", json={**BODY, "customer_requested_discount_pct": 101})
    assert over.status_code == 422 and over.json()["errors"][0]["code"] == "invalid_requested_discount"


def test_legacy_discount_pct_field_is_still_accepted(client):
    body = {k: v for k, v in BODY.items() if k not in ("proposed_discount_pct", "customer_requested_discount_pct")}
    r = client.post("/api/quotes/calculate", json={**body, "discount_pct": 12})
    assert r.status_code == 200 and r.json()["proposed_discount_pct"] == 12 and r.json()["total_cents"] == 880_000


def test_full_approval_lifecycle(client):
    q = client.post("/api/quotes", json=BODY).json()
    assert q["approved_discount_pct"] is None and q["customer_requested_discount_pct"] == 22 and "discount_pct" not in q
    assert "Customer requested discount: 22%" in q["history"][0]["note"]
    url = f"/api/quotes/{q['id']}/status"
    assert client.patch(url, json={"status": "approved"}).status_code == 409           # must be submitted first
    assert client.patch(url, json={"status": "submitted"}).status_code == 200
    bad = client.patch(url, json={"status": "approved", "approved_discount_pct": 19})
    assert bad.status_code == 422 and bad.json()["errors"][0]["code"] == "approved_above_proposed"
    assert client.get(f"/api/quotes/{q['id']}").json()["status"] == "submitted"        # failed approval changed nothing
    done = client.patch(url, json={"status": "approved", "approved_discount_pct": 15, "comment": "OK"}).json()
    assert done["status"] == "approved" and done["approved_discount_pct"] == 15 and done["proposed_discount_pct"] == 18
    assert done["approved"]["total_cents"] == 850_000 and done["calculation"]["total_cents"] == 820_000
    assert "18% → 15%" in done["history"][-1]["note"] and done["allowed_transitions"] == []
    assert any("final approved total is $8,500" in s for s in done["explanation"])
    row = client.get("/api/quotes").json()[0]
    assert (row["proposed_discount_pct"], row["approved_discount_pct"], row["final_total_cents"]) == (18, 15, 850_000)
    assert client.get("/api/stats").json()["value_by_status_cents"]["approved"] == 850_000
    csv = client.get(f"/api/quotes/{q['id']}/export.csv").text
    assert "Final approved total,8500.00" in csv and "Approved discount (%),15.0" in csv


def test_rejection_with_reason(client):
    qid = client.post("/api/quotes", json=BODY).json()["id"]
    url = f"/api/quotes/{qid}/status"
    client.patch(url, json={"status": "submitted"})
    assert client.patch(url, json={"status": "rejected", "approved_discount_pct": 10}).status_code == 422
    r = client.patch(url, json={"status": "rejected", "comment": "Discount is too high for this customer segment."}).json()
    assert r["status"] == "rejected" and r["approved_discount_pct"] is None
    assert r["history"][-1]["comment"] == "Discount is too high for this customer segment."
    assert "Reason:" in r["history"][-1]["note"]
    assert client.patch(url, json={"status": "approved"}).status_code == 409           # final


def test_old_quotes_without_the_new_fields_still_load(tmp_path):
    quotes = tmp_path / "quotes.json"
    line = {"sku": "AGENT-CORE", "name": "Agent Core", "quantity": 10, "unit_price_cents": 12000, "line_total_cents": 120000}
    quotes.write_text(json.dumps([{
        "id": "Q-OLD00001", "customer_name": "Legacy Co", "seats": 10, "annual_commitment": False, "discount_pct": 12.0,
        "status": "submitted", "created_at": "2026-01-01T00:00:00+00:00", "updated_at": "2026-01-01T00:00:00+00:00",
        "history": [{"from": None, "to": "draft", "at": "2026-01-01T00:00:00+00:00"}],
        "calculation": {"tier": "GROWTH", "tier_max_discount_pct": 20, "seats": 10, "lines": [line], "subtotal_cents": 120000,
                        "discount_pct": 12.0, "discount_amount_cents": 14400, "total_cents": 105600, "annual_commitment": False,
                        "approval_required": False, "approval_reasons": [], "approval_messages": [],
                        "limits": {"approval_discount_pct": 15.0, "annual_discount_pct": 10.0, "approval_total_cents": 2500000}}}]))
    c = authed(create_app(CATALOG, quotes))
    q = c.get("/api/quotes/Q-OLD00001").json()
    assert q["proposed_discount_pct"] == 12 and q["customer_requested_discount_pct"] is None and q["approved_discount_pct"] is None
    assert c.get("/api/quotes").json()[0]["proposed_discount_pct"] == 12
    assert c.get("/api/quotes/export.csv").status_code == 200
    done = c.patch("/api/quotes/Q-OLD00001/status", json={"status": "approved", "approved_discount_pct": 10}).json()
    assert done["approved"]["total_cents"] == 108000 and done["calculation"]["total_cents"] == 105600
