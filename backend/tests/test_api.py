"""API tests through FastAPI's TestClient (a real HTTP-style request/response cycle)."""
import json
import shutil
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.main import create_app

CATALOG = Path(__file__).parent.parent / "data" / "catalog.json"
GOOD = {"customer_name": "Acme", "seats": 50, "annual_commitment": False, "discount_pct": 20,
        "lines": [{"sku": "AGENT-CORE", "quantity": 100}, {"sku": "ONBOARDING", "quantity": 1}]}


def authed(app):
    """A TestClient that is logged in as a demo rep (registers, or logs in if the account exists)."""
    c = TestClient(app)
    creds = {"email": "rep@acme.com", "password": "password123"}
    r = c.post("/api/auth/register", json={"name": "Rep", **creds})
    if r.status_code == 409:
        r = c.post("/api/auth/login", json=creds)
    c.headers["Authorization"] = f"Bearer {r.json()['token']}"
    return c


@pytest.fixture
def client(tmp_path):
    return authed(create_app(CATALOG, tmp_path / "quotes.json"))


def test_catalog(client):
    body = client.get("/api/catalog").json()
    assert len(body["products"]) == 4 and len(body["discount_rules"]) == 3


def test_calculate_returns_authoritative_numbers(client):
    r = client.post("/api/quotes/calculate", json=GOOD)
    assert r.status_code == 200
    body = r.json()
    assert body["total_cents"] == 1_160_000 and body["tier"] == "ENTERPRISE"
    assert body["approval_reasons"] == ["discount_above_15_percent"]
    assert body["explanation"][0].startswith("50 seats")


def test_validation_error_is_422_with_readable_messages(client):
    bad = {**GOOD, "seats": 0, "lines": [], "discount_pct": 99}
    r = client.post("/api/quotes/calculate", json=bad)
    assert r.status_code == 422
    errs = r.json()["errors"]
    assert {e["code"] for e in errs} == {"invalid_seats", "no_line_items"}
    assert all(e["message"] for e in errs)


def test_wrong_json_types_use_the_same_error_shape(client):
    r = client.post("/api/quotes/calculate", json={**GOOD, "seats": "lots"})
    assert r.status_code == 422 and r.json()["errors"][0]["field"] == "seats"


def test_save_requires_customer_name(client):
    r = client.post("/api/quotes", json={**GOOD, "customer_name": "  "})
    assert r.status_code == 422 and r.json()["errors"][0]["code"] == "customer_required"


def test_save_get_list_and_search(client):
    created = client.post("/api/quotes", json=GOOD)
    assert created.status_code == 201
    qid = created.json()["id"]
    assert client.get(f"/api/quotes/{qid}").json()["calculation"]["total_cents"] == 1_160_000
    assert len(client.get("/api/quotes").json()) == 1
    assert client.get("/api/quotes", params={"q": "zzz"}).json() == []
    assert client.get("/api/quotes/Q-NOPE").status_code == 404


def test_status_workflow_blocks_invalid_jumps(client):
    qid = client.post("/api/quotes", json=GOOD).json()["id"]
    url = f"/api/quotes/{qid}/status"
    assert client.patch(url, json={"status": "approved"}).status_code == 409   # draft -> approved
    assert client.patch(url, json={"status": "submitted"}).status_code == 200
    assert client.patch(url, json={"status": "draft"}).status_code == 409      # no going back
    r = client.patch(url, json={"status": "rejected"})
    assert r.status_code == 200 and r.json()["allowed_transitions"] == []
    assert client.patch(url, json={"status": "approved"}).status_code == 409   # final
    assert [h["to"] for h in r.json()["history"]] == ["draft", "submitted", "rejected"]


def test_compare_two_scenarios(client):
    a = client.post("/api/quotes", json={**GOOD, "discount_pct": 10}).json()["id"]
    b = client.post("/api/quotes", json={**GOOD, "discount_pct": 20}).json()["id"]
    diff = client.get("/api/quotes/compare", params={"a": a, "b": b}).json()["differences"]
    assert any("Approval now required" in s for s in diff)


def test_saved_quote_survives_catalog_change(tmp_path):
    quotes = tmp_path / "q.json"
    qid = authed(create_app(CATALOG, quotes)).post("/api/quotes", json=GOOD).json()["id"]
    reduced = tmp_path / "catalog.json"
    data = json.loads(CATALOG.read_text())
    data["products"] = [p for p in data["products"] if p["sku"] != "ONBOARDING"]
    reduced.write_text(json.dumps(data))
    body = authed(create_app(reduced, quotes)).get(f"/api/quotes/{qid}").json()
    assert body["calculation"]["total_cents"] == 1_160_000          # unchanged snapshot
    assert any("no longer in the catalog" in w for w in body["warnings"])


def test_stats_and_csv_export(client):
    client.post("/api/quotes", json=GOOD)  # 20% on ENTERPRISE -> needs approval
    s = client.get("/api/stats").json()
    assert s["count"] == 1 and s["by_status"]["draft"] == 1 and s["needs_approval"] == 1
    assert s["value_by_status_cents"]["draft"] == 1_160_000
    r = client.get("/api/quotes/export.csv")
    assert r.headers["content-type"].startswith("text/csv")
    assert "Acme" in r.text and "11600.00" in r.text


def test_register_login_and_me(tmp_path):
    c = TestClient(create_app(CATALOG, tmp_path / "q.json"))
    reg = c.post("/api/auth/register", json={"name": "Asha", "email": "Asha@Corp.com", "password": "longenough1"})
    assert reg.status_code == 201 and reg.json()["user"]["email"] == "asha@corp.com"
    assert "password" not in json.dumps(reg.json())
    assert c.post("/api/auth/register", json={"name": "A", "email": "asha@corp.com", "password": "longenough1"}).status_code == 409
    assert c.post("/api/auth/login", json={"email": "asha@corp.com", "password": "wrong-pass"}).status_code == 401
    ok = c.post("/api/auth/login", json={"email": "ASHA@corp.com", "password": "longenough1"}).json()
    assert c.get("/api/auth/me", headers={"Authorization": f"Bearer {ok['token']}"}).json()["name"] == "Asha"


def test_register_validation_messages(client):
    r = client.post("/api/auth/register", json={"name": "", "email": "nope", "password": "123"})
    assert r.status_code == 422 and {e["code"] for e in r.json()["errors"]} == {"name_required", "invalid_email", "weak_password"}


def test_quote_routes_require_login(tmp_path):
    c = TestClient(create_app(CATALOG, tmp_path / "q.json"))
    assert c.get("/api/catalog").status_code == 200  # public
    for path in ("/api/quotes", "/api/stats", "/api/quotes/export.csv"):
        r = c.get(path)
        assert r.status_code == 401 and r.json()["errors"][0]["code"] == "unauthorized"
    assert c.get("/api/quotes", headers={"Authorization": "Bearer forged.token"}).status_code == 401


def test_quote_csv_download_and_formula_safety(client):
    qid = client.post("/api/quotes", json={**GOOD, "customer_name": "=HYPERLINK(\"evil\")"}).json()["id"]
    r = client.get(f"/api/quotes/{qid}/export.csv")
    assert r.status_code == 200 and f"{qid}.csv" in r.headers["content-disposition"]
    assert "AGENT-CORE" in r.text and "11600.00" in r.text and "Approval required" in r.text
    assert "'=HYPERLINK" in r.text                      # neutralised, not a live formula
    assert "'=HYPERLINK" in client.get("/api/quotes/export.csv").text
    assert client.get("/api/quotes/Q-NOPE/export.csv").status_code == 404
