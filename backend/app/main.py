"""FastAPI routes. Thin: validation + business rules are in pricing.py / workflow.py."""
from __future__ import annotations

import csv
import io
import os
import uuid
from datetime import datetime, timezone
from decimal import Decimal
from pathlib import Path
from typing import Any, Literal

from fastapi import Depends, FastAPI, Header, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response
from pydantic import BaseModel, Field

from .auth import hash_password, make_token, read_token, validate_registration, verify_password
from .explain import coach, compare_sentences, created_note, explain, explain_approval, resolutions
from .legacy import normalize_quote
from .pricing import (ANNUAL_DISCOUNT_PCT, APPROVAL_DISCOUNT_PCT, APPROVAL_TOTAL_CENTS,
                      QuoteValidationError, calculate, load_catalog)
from .storage import QuoteStore
from .workflow import InvalidTransition, allowed_next, apply_status_change

BASE = Path(__file__).resolve().parent.parent


# ----------------------------------------------------------- request schemas
class LineIn(BaseModel):
    sku: str = ""
    quantity: int | None = None


class DraftIn(BaseModel):
    customer_name: str = ""
    seats: int | None = None
    lines: list[LineIn] = []
    # What the customer asked for. Optional, information only: never used for pricing, validation or approval.
    customer_requested_discount_pct: Decimal | None = Field(default=None, allow_inf_nan=False)
    # The discount actually quoted. Drives totals, tier validation and approval rules. Defaults to 0 (stored as 0).
    proposed_discount_pct: Decimal | None = Field(default=None, allow_inf_nan=False)
    # Legacy name for proposed_discount_pct, still accepted so older clients keep working.
    discount_pct: Decimal | None = Field(default=None, allow_inf_nan=False)
    annual_commitment: bool = False


class RegisterIn(BaseModel):
    name: str = ""
    email: str = ""
    password: str = ""


class LoginIn(BaseModel):
    email: str = ""
    password: str = ""


class StatusIn(BaseModel):
    status: Literal["draft", "submitted", "approved", "rejected"]
    approved_discount_pct: Decimal | None = Field(default=None, allow_inf_nan=False)  # only valid with "approved"
    comment: str | None = Field(default=None, max_length=500)                         # e.g. the rejection reason


class ApiError(Exception):
    def __init__(self, status: int, code: str, message: str):
        self.status, self.code, self.message = status, code, message


def usd(cents: int) -> str:
    return f"{cents // 100}.{cents % 100:02d}"


def safe_cell(value: Any) -> Any:
    """Stop spreadsheet formula injection: a customer called '=HYPERLINK(...)' must stay plain text."""
    return "'" + value if isinstance(value, str) and value[:1] in ("=", "+", "-", "@", "\t", "\r") else value


def csv_response(rows: list[list[Any]], filename: str) -> Response:
    out = io.StringIO()
    csv.writer(out).writerows(rows)
    return Response("\ufeff" + out.getvalue(),  # BOM so Excel reads UTF-8 correctly
                    media_type="text/csv; charset=utf-8",
                    headers={"Content-Disposition": f'attachment; filename="{filename}"'})


def _blank(v: Any) -> Any:
    return "" if v is None else v


def now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def create_app(catalog_path: str | Path | None = None, quotes_path: str | Path | None = None,
               users_path: str | Path | None = None) -> FastAPI:
    catalog = load_catalog(catalog_path or os.getenv("CATALOG_FILE", BASE / "data" / "catalog.json"))
    store = QuoteStore(quotes_path or os.getenv("QUOTES_FILE", BASE / "data" / "quotes.json"))
    users_file = users_path or (Path(quotes_path).parent / "users.json" if quotes_path
                                else os.getenv("USERS_FILE", BASE / "data" / "users.json"))
    users = QuoteStore(users_file)  # same tiny JSON store, reused for accounts
    secret = os.getenv("AUTH_SECRET", "dev-only-secret-change-me")
    app = FastAPI(title="Deal Desk Quote Simulator API")
    origins = os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")
    app.add_middleware(CORSMiddleware, allow_origins=origins, allow_methods=["*"], allow_headers=["*"])

    # ---- one error shape for everything: {"errors": [{field, code, message}]}
    @app.exception_handler(QuoteValidationError)
    async def _quote_invalid(_: Request, exc: QuoteValidationError):
        return JSONResponse(status_code=422, content={"errors": exc.errors})

    @app.exception_handler(RequestValidationError)
    async def _bad_shape(_: Request, exc: RequestValidationError):
        errs = []
        for e in exc.errors():
            field = ".".join(str(p) for p in e["loc"][1:])
            errs.append({"field": field, "code": "invalid_value", "message": f"Invalid value for '{field}': {e['msg']}."})
        return JSONResponse(status_code=422, content={"errors": errs})

    @app.exception_handler(InvalidTransition)
    async def _bad_transition(_: Request, exc: InvalidTransition):
        return JSONResponse(status_code=409, content={"errors": [{"field": "", "code": "invalid_transition", "message": str(exc)}]})

    @app.exception_handler(ApiError)
    async def _api_error(_: Request, exc: ApiError):
        return JSONResponse(status_code=exc.status, content={"errors": [{"field": "", "code": exc.code, "message": exc.message}]})

    # ---- auth
    def current_user(authorization: str | None = Header(default=None)) -> dict[str, Any]:
        uid = read_token((authorization or "").removeprefix("Bearer ").strip(), secret)
        user = users.get(uid) if uid else None
        if user is None:
            raise ApiError(401, "unauthorized", "Please log in to continue.")
        return user

    protected = [Depends(current_user)]

    def public(u: dict[str, Any]) -> dict[str, Any]:
        return {"id": u["id"], "name": u["name"], "email": u["email"]}

    def session(u: dict[str, Any]) -> dict[str, Any]:
        return {"token": make_token(u["id"], secret), "user": public(u)}

    @app.post("/api/auth/register", status_code=201)
    def register(body: RegisterIn):
        errs = validate_registration(body.name, body.email, body.password)
        if errs:
            raise QuoteValidationError(errs)
        email = body.email.strip().lower()
        if any(u["email"] == email for u in users.all()):
            raise ApiError(409, "email_taken", "An account with this email already exists. Log in instead.")
        user = {"id": "U-" + uuid.uuid4().hex[:8], "name": body.name.strip(), "email": email,
                "password_hash": hash_password(body.password), "created_at": now()}
        users.add(user)
        return session(user)

    @app.post("/api/auth/login")
    def login(body: LoginIn):
        email = body.email.strip().lower()
        user = next((u for u in users.all() if u["email"] == email), None)
        if user is None or not verify_password(body.password, user["password_hash"]):
            raise ApiError(401, "invalid_credentials", "Email or password is incorrect.")
        return session(user)

    @app.get("/api/auth/me")
    def me(user: dict[str, Any] = Depends(current_user)):
        return public(user)

    # ---- helpers
    def present(q: dict[str, Any]) -> dict[str, Any]:
        """Saved quote + explanation + warnings if the catalog changed since it was saved."""
        q = normalize_quote(q)
        products = {p["sku"]: p for p in catalog["products"]}
        warnings = []
        for line in q["calculation"]["lines"]:
            current = products.get(line["sku"])
            if current is None:
                warnings.append(f"{line['name']} ({line['sku']}) is no longer in the catalog. Showing the price it was quoted at.")
            elif current["unit_price_cents"] != line["unit_price_cents"]:
                warnings.append(f"{line['name']} price has changed in the catalog since this quote was saved. Showing the original price.")
        return {**q, "explanation": explain(q["calculation"]) + explain_approval(q),
                "allowed_transitions": allowed_next(q["status"]), "warnings": warnings}

    def final_total(q: dict[str, Any]) -> int:
        """The approved total once a manager has approved a discount, otherwise the proposed total."""
        return q["approved"]["total_cents"] if q.get("approved") else q["calculation"]["total_cents"]

    def all_quotes() -> list[dict[str, Any]]:
        return [normalize_quote(x) for x in store.all()]

    def summary(q: dict[str, Any]) -> dict[str, Any]:
        q = normalize_quote(q)
        c = q["calculation"]
        return {"id": q["id"], "customer_name": q["customer_name"], "status": q["status"], "seats": q["seats"],
                "tier": c["tier"], "total_cents": c["total_cents"], "approval_required": c["approval_required"],
                "customer_requested_discount_pct": q["customer_requested_discount_pct"],
                "proposed_discount_pct": q["proposed_discount_pct"],
                "approved_discount_pct": q["approved_discount_pct"],
                "final_total_cents": final_total(q) if q["approved"] else None,
                "created_at": q["created_at"]}

    def must_get(quote_id: str) -> dict[str, Any]:
        q = store.get(quote_id)
        if q is None:
            raise ApiError(404, "not_found", f"Quote '{quote_id}' was not found.")
        return normalize_quote(q)

    # ---- routes
    @app.get("/api/catalog")
    def get_catalog():
        return {**catalog, "limits": {
            "approval_discount_pct": float(APPROVAL_DISCOUNT_PCT),
            "annual_discount_pct": float(ANNUAL_DISCOUNT_PCT),
            "approval_total_cents": APPROVAL_TOTAL_CENTS}}

    @app.post("/api/quotes/calculate", dependencies=protected)
    def calculate_quote(draft: DraftIn):
        d = draft.model_dump()
        calc = calculate(d, catalog)
        return {**calc, "explanation": explain(calc), "coach": coach(d, calc, catalog),
                "resolutions": resolutions(d, calc, catalog)}

    @app.post("/api/quotes", dependencies=protected, status_code=201)
    def create_quote(draft: DraftIn):
        d = draft.model_dump()
        calc = calculate(d, catalog, require_customer=True)
        ts = now()
        quote = {
            "id": "Q-" + uuid.uuid4().hex[:8].upper(),
            "customer_name": d["customer_name"].strip(),
            "seats": d["seats"],
            "annual_commitment": d["annual_commitment"],
            "customer_requested_discount_pct": calc["customer_requested_discount_pct"],
            "proposed_discount_pct": calc["proposed_discount_pct"],
            "approved_discount_pct": None,  # "Pending": only a manager can set it, through the approval action
            "approved": None,
            "status": "draft",
            "history": [{"from": None, "to": "draft", "at": ts, "note": created_note(calc),
                         "customer_requested_discount_pct": calc["customer_requested_discount_pct"],
                         "proposed_discount_pct": calc["proposed_discount_pct"]}],
            "created_at": ts,
            "updated_at": ts,
            "calculation": calc,  # snapshot: names and prices as quoted
        }
        store.add(quote)
        return present(quote)

    @app.get("/api/quotes", dependencies=protected)
    def list_quotes(status: str | None = None, q: str | None = None):
        items = all_quotes()
        if status:
            items = [x for x in items if x["status"] == status]
        if q:
            items = [x for x in items if q.lower() in x["customer_name"].lower()]
        return [summary(x) for x in sorted(items, key=lambda x: x["created_at"], reverse=True)]

    @app.get("/api/stats", dependencies=protected)
    def stats():
        items = all_quotes()
        statuses = ("draft", "submitted", "approved", "rejected")
        by = {s: sum(1 for x in items if x["status"] == s) for s in statuses}
        value = {s: sum(final_total(x) for x in items if x["status"] == s) for s in statuses}
        waiting = sum(1 for x in items if x["calculation"]["approval_required"] and x["status"] in ("draft", "submitted"))
        recent = sorted(items, key=lambda x: x["created_at"], reverse=True)[:5]
        return {"count": len(items), "by_status": by, "value_by_status_cents": value,
                "needs_approval": waiting, "recent": [summary(x) for x in recent]}

    @app.get("/api/quotes/export.csv", dependencies=protected)  # before /{quote_id}, like /compare
    def export_csv():
        rows: list[list[Any]] = [["id", "customer", "seats", "tier", "requested_discount_pct", "proposed_discount_pct",
                                  "approved_discount_pct", "total_usd", "final_total_usd", "approval_required", "status", "created_at"]]
        for x in all_quotes():
            c = x["calculation"]
            rows.append([x["id"], safe_cell(x["customer_name"]), x["seats"], c["tier"],
                         _blank(x["customer_requested_discount_pct"]), x["proposed_discount_pct"],
                         _blank(x["approved_discount_pct"]), usd(c["total_cents"]),
                         usd(final_total(x)) if x["approved"] else "", "yes" if c["approval_required"] else "no",
                         x["status"], x["created_at"]])
        return csv_response(rows, "quotes.csv")

    @app.get("/api/quotes/{quote_id}/export.csv", dependencies=protected)
    def export_quote_csv(quote_id: str):
        q = must_get(quote_id)
        c = q["calculation"]
        rows: list[list[Any]] = [
            ["Quote", q["id"]], ["Customer", safe_cell(q["customer_name"])], ["Status", q["status"]],
            ["Seats", q["seats"]], ["Tier", c["tier"]], ["Annual commitment", "yes" if c["annual_commitment"] else "no"],
            ["Created", q["created_at"]], [],
            ["sku", "product", "quantity", "unit_price_usd", "line_total_usd"],
            *[[l["sku"], l["name"], l["quantity"], usd(l["unit_price_cents"]), usd(l["line_total_cents"])] for l in c["lines"]],
            [],
            ["Subtotal", usd(c["subtotal_cents"])], ["Customer requested discount (%)", _blank(q["customer_requested_discount_pct"])],
            ["Proposed discount (%)", q["proposed_discount_pct"]],
            ["Proposed discount amount", "-" + usd(c["discount_amount_cents"])], ["Proposed total", usd(c["total_cents"])],
            ["Approved discount (%)", "Pending" if q["approved_discount_pct"] is None else q["approved_discount_pct"]],
            *([["Final approved total", usd(q["approved"]["total_cents"])]] if q["approved"] else []),
            ["Approval required", "yes" if c["approval_required"] else "no"],
            *[["Reason", m] for m in c["approval_messages"]],
        ]
        return csv_response(rows, f"{q['id']}.csv")

    @app.get("/api/quotes/compare", dependencies=protected)  # declared before /{quote_id} so "compare" isn't read as an id
    def compare(a: str, b: str):
        qa, qb = must_get(a), must_get(b)
        return {"a": present(qa), "b": present(qb),
                "differences": compare_sentences(qa["calculation"], qb["calculation"])}

    @app.get("/api/quotes/{quote_id}", dependencies=protected)
    def get_quote(quote_id: str):
        return present(must_get(quote_id))

    @app.patch("/api/quotes/{quote_id}/status", dependencies=protected)
    def change_status(quote_id: str, body: StatusIn):
        def mutate(q: dict[str, Any]) -> None:  # all rules live in workflow.apply_status_change
            apply_status_change(q, body.status, body.approved_discount_pct, body.comment, now())

        updated = store.update(quote_id, mutate)
        if updated is None:
            raise ApiError(404, "not_found", f"Quote '{quote_id}' was not found.")
        return present(updated)

    return app


app = create_app()
