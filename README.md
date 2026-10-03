# Deal Desk Quote Simulator

A sales rep builds a customer quote, sees the live calculation, learns whether approval is needed (and why),
then saves it and moves it through review. **Python/FastAPI backend + Next.js/TypeScript frontend**, talking over HTTP.

## Run it (about 5 minutes)

**Backend** (Python 3.10+)
```bash
cd backend
python -m venv .venv && source .venv/bin/activate      # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```
API docs: http://localhost:8000/docs

**Frontend** (Node 18+)
```bash
cd frontend
cp ../.env.example .env.local        # only NEXT_PUBLIC_API_URL is used here
npm install
npm run dev                          # http://localhost:3000
```

## Tests
```bash
cd backend  && pytest        # business rules, boundaries, discount negotiation, approvals, API, old-quote compatibility
cd frontend && npm test      # money formatting + draft-recovery guard (vitest)
```

## Discounts: four different things
| Name | Meaning | Used for pricing / approval? |
|---|---|---|
| **Customer requested discount** (`customer_requested_discount_pct`) | What the customer asks for. Optional. May be above the tier maximum. | **No.** Negotiation information only. |
| **Proposed discount** (`proposed_discount_pct`) | What the salesperson offers. | **Yes.** Subtotal/discount/total, tier-max validation, approval rules, Deal Coach. |
| **Tier maximum** | Hard policy limit from the seat tier (Starter 10%, Growth 20%, Enterprise 30%). | Proposed and approved discounts must stay within it. |
| **Approved discount** (`approved_discount_pct`) | Set by a manager when approving. "Pending" until then. Never above the proposal or the tier max. | Gives the **final approved total**. The proposal is kept for the audit trail. |

Flow: customer requested → salesperson proposed → manager approved → final quote. The builder shows the gap in
**percentage points** ("Customer asked for 3 percentage points more than your proposal."), "Ways to remove approval"
what-if options (simulations; you choose whether to apply them), and the review page has an **Approval review** panel
(approved discount + approve / reject with a reason). Every step is written to the history.
Quotes saved before these fields existed (only `discount_pct`) still load: `discount_pct` is read as the proposed discount.

## Features
**Must build:** quote builder with live preview · all 5 endpoints · review page with status actions · tests.
**Should build:** quote comparison (tick two quotes on the list) · "Explain pricing" · draft recovery (localStorage).
**Extras:** Deal Coach tips · approval meters · copy-explanation button · audit-trail timeline · list search/filter ·
dashboard · CSV export · "Create scenario B" from any saved quote · print-friendly review page · catalog-drift warnings.

## API
All `/api/quotes*` and `/api/stats` routes need a login token. Passwords are salted PBKDF2 hashes; tokens are HMAC-signed and expire after 7 days (set `AUTH_SECRET`).
All money is **integer cents** (`*_cents`). All errors share one shape: `{"errors":[{"field","code","message"}]}`.

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/auth/register` | create an account → `{token, user}` |
| POST | `/api/auth/login` | log in → `{token, user}` |
| GET | `/api/auth/me` | current user (needs `Authorization: Bearer <token>`) |
| GET | `/api/catalog` | products, tier rules, approval limits |
| POST | `/api/quotes/calculate` | authoritative calculation + explanation + coach tips (422 with messages if invalid) |
| POST | `/api/quotes` | validate and save (also requires a customer name) → 201 |
| GET | `/api/quotes?status=&q=` | list summaries, newest first |
| GET | `/api/stats` | dashboard numbers: counts, pipeline value, waiting on approval |
| GET | `/api/quotes/export.csv` | download all quotes as CSV (login required) |
| GET | `/api/quotes/{id}/export.csv` | download one quote with its line items as CSV |
| GET | `/api/quotes/compare?a=&b=` | two saved quotes + sentences describing the difference |
| GET | `/api/quotes/{id}` | saved quote, explanation, allowed next statuses, warnings |
| PATCH | `/api/quotes/{id}/status` | `{"status":"approved","approved_discount_pct":15,"comment":"..."}` or `{"status":"rejected","comment":"reason"}`; 409 for an invalid jump, 422 for an invalid approved discount |

Request body for calculate/save (`discount_pct` is still accepted as an alias of `proposed_discount_pct`):
```json
{"customer_name":"Acme","seats":50,"annual_commitment":false,
 "customer_requested_discount_pct":25,"proposed_discount_pct":20,
 "lines":[{"sku":"AGENT-CORE","quantity":100}]}
```
Response (trimmed): `{"tier":"ENTERPRISE","subtotal_cents":1450000,"discount_amount_cents":290000,"total_cents":1160000,
"approval_required":true,"approval_reasons":["discount_above_15_percent"], ...}`

## Layout
```
backend/app/pricing.py   ALL business rules (pure functions)      backend/app/workflow.py  status transitions
backend/app/explain.py   explanation, Deal Coach, comparison text  backend/app/storage.py   JSON file store
backend/app/main.py      FastAPI routes + error handling           backend/data/catalog.json (unmodified)
frontend/app/*           builder, quotes list, review, compare     frontend/lib/*           API client, types, draft storage
```
