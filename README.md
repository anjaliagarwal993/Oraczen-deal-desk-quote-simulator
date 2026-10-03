# Deal Desk Quote Simulator

A full-stack internal sales tool for creating, pricing, comparing and approving customer quotes. A sales rep picks products and seats, enters the customer's requested discount and their own proposed discount, and sees the price, the pricing tier and whether the quote needs approval (and why) before saving.

**Stack:** Next.js + React + TypeScript (frontend) · Python + FastAPI (backend) · REST APIs · JSON file storage.
All pricing, tier and approval rules are calculated and validated on the **backend**; the frontend only displays the results.

## Live Demo

| Resource | Link |
|---|---|
| Frontend | https://oraczen-deal-desk-quote-simulator.vercel.app |
| Backend API | https://oraczen-deal-desk-quote-simulator.onrender.com |
| API docs (Swagger) | https://oraczen-deal-desk-quote-simulator.onrender.com/docs |
| GitHub | https://github.com/anjaliagarwal993/Oraczen-deal-desk-quote-simulator |

> The free Render backend sleeps after inactivity, so the first request may take about a minute.

---

# Quick Start (Setup, Run, Test)

**Prerequisites:** Python 3.10+, Node.js 18+, npm, Git.

## 1. Clone

```bash
git clone https://github.com/anjaliagarwal1993/Oraczen-deal-desk-quote-simulator.git
cd Oraczen-deal-desk-quote-simulator
```

## 2. Backend (Terminal 1)

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate          # Windows
# source .venv/bin/activate     # macOS / Linux
pip install -r requirements.txt
```

Create `backend/.env` (a safe template is in `.env.example`; never commit the real file):

```env
CATALOG_FILE=data/catalog.json
QUOTES_FILE=data/quotes.json
USERS_FILE=data/users.json
CORS_ORIGINS=http://localhost:3000
AUTH_SECRET=change-me-to-a-long-random-secret
```

Run it:

```bash
uvicorn app.main:app --reload --port 8000
```

Backend: http://localhost:8000 · Swagger docs: http://localhost:8000/docs

## 3. Frontend (Terminal 2)

```bash
cd frontend
npm install
```

Create `frontend/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

Run it:

```bash
npm run dev
```

Open http://localhost:3000, register an account and log in. Both services must be running.

## 4. Run the tests

```bash
# Backend (from /backend)
python -m pytest

# Frontend (from /frontend)
npm test              # unit tests (Vitest)
npm run typecheck     # TypeScript check
npm run build         # production build check
```

**Backend tests cover:** pricing calculations, tier boundaries, discount validation, approval rules, API validation, quote workflow, comparison, authentication, old saved-quote compatibility and catalog behavior.

---

# Screenshots

**Landing page** – introduces the workflow and the requested vs proposed vs policy-maximum comparison.

<img width="1897" height="842" alt="Landing Page" src="https://github.com/user-attachments/assets/75bb18a9-05db-4990-abb6-f47db0617357" />

**Feature overview** – live pricing, negotiation visibility, approval explanations, Deal Coach, what-if analysis and comparison.

<img width="1886" height="858" alt="Feature Overview" src="https://github.com/user-attachments/assets/5946a537-f9b6-4e2b-bd27-b0e96672d950" />

**Dashboard** – quote counts, open pipeline, approved value, deals waiting for approval, status distribution, deal health and recent quotes.

<img width="1897" height="817" alt="Dashboard" src="https://github.com/user-attachments/assets/54799e4e-bedf-4e4e-bf68-3f5380ccebef" />

<img width="1871" height="433" alt="Dashboard Analytics" src="https://github.com/user-attachments/assets/bbae81e1-bd8b-4f46-aee5-e8be5119f949" />

**Saved quotes** – search, status filter, quote details and selection for comparison.

<img width="1885" height="767" alt="Saved Quotes" src="https://github.com/user-attachments/assets/e5e69930-c1d9-40d9-97bc-add0d6fe1fd5" />

**Compare scenarios** – pick two saved quotes and see exactly what changed (pricing, seats, discounts, products, commitment, approval).

<img width="1881" height="858" alt="Compare Scenarios" src="https://github.com/user-attachments/assets/51743d0c-c26f-4ed5-8232-9ec7b9ca8441" />

**Side-by-side analysis** – approval reasons, tiers, discount limits, negotiation details and line items for both scenarios.

<img width="1865" height="832" alt="Side-by-Side Comparison" src="https://github.com/user-attachments/assets/a41a53d0-2d2e-4611-a4cb-1eff8ed4ca4e" />

<img width="1861" height="861" alt="Detailed Comparison" src="https://github.com/user-attachments/assets/6ac049d7-5713-405d-ad68-a5d88dd15108" />

---

# Business Rules

## Pricing tiers (by seats)

| Seats | Tier | Maximum discount |
|------:|------|-----------------:|
| 1–9 | STARTER | 10% |
| 10–49 | GROWTH | 20% |
| 50+ | ENTERPRISE | 30% |

The proposed discount is validated against the maximum for the tier.

## Price calculation

```text
Line Total      = Quantity × Unit Price
Subtotal        = Sum of line totals
Discount Amount = Subtotal × Proposed Discount %
Total           = Subtotal − Discount Amount
```

All money is stored as **integer cents** to avoid floating-point errors.

## When approval is required

A quote needs manager approval if **any** of these is true:

```text
Proposed discount > 15%
OR  Total > $25,000
OR  Annual commitment = true AND Proposed discount > 10%
```

The app shows the specific reasons, not just a generic warning. Annual commitment affects approval only, never the price.

## Four different discounts

| Discount | Meaning | Used for pricing / approval? |
|---|---|---|
| Customer requested | What the customer asked for (optional, may exceed the tier max) | No – negotiation context only |
| Proposed | What the salesperson offers | Yes |
| Tier maximum | Policy limit for the seat tier | Yes – limit for proposed and approved |
| Approved | Set by a manager on approval; never above the proposal or tier max | Yes – gives the final approved total |

Example: customer asks 22%, salesperson proposes 18%, tier maximum is 20%. The 18% drives the price and approval; the 22% is shown for context. The approved discount is stored separately so the original proposal stays in the audit history.

## Quote workflow

```text
Draft → Submitted → Approved
                  → Rejected
```

The backend validates every transition (invalid jumps return `409`). Approved and rejected are final.

---

# Features

**Core**
- Register / login with protected routes (PBKDF2 password hashing, HMAC-signed tokens that expire after 7 days)
- Quote builder with live pricing preview from the backend, multiple products and quantities, requested and proposed discount, annual commitment
- Quote review page with status actions: submit, approve (with approved discount) and reject (with reason)
- Saved quotes with search and status filter

**Decision support**
- Negotiation view: requested vs proposed vs tier maximum, with the gap in percentage points
- Deal Coach: rule-based tips (for example, how far to lower the discount to avoid approval). It never changes the quote by itself
- What-if options: preview a change before applying it
- Explain pricing: a readable breakdown of how the total was calculated, with a copy button
- Scenario comparison: pick two quotes, get a side-by-side view and plain-English sentences describing the differences; "Create scenario B" copies a saved quote into the builder

**Operations and safety**
- Dashboard: total quotes, open pipeline, approved value, waiting for approval, status distribution, deal health, recent activity
- Audit trail: creation, discount changes, status changes, approvals and rejections with comments
- Draft recovery: an unfinished quote is restored from browser `localStorage` after a refresh
- Catalog-drift warnings: saved quotes keep the product snapshot they were created with; a warning shows if the current catalog differs
- CSV export: all quotes, or one quote with its line items
- Print-friendly review page (use Print / Save as PDF in the browser)

---

# Architecture

```text
User → Next.js frontend (Vercel) → REST/HTTP → FastAPI backend (Render)
                                                 ├─ pricing.py   (pricing, tiers, approval rules)
                                                 ├─ workflow.py  (status transitions)
                                                 ├─ explain.py   (explanations, Deal Coach)
                                                 └─ storage.py   (JSON: catalog, quotes, users)
```

## Project structure

```text
deal-desk-quote-simulator/
├── backend/
│   ├── app/            main.py, pricing.py, workflow.py, explain.py, storage.py
│   ├── data/           catalog.json
│   ├── tests/
│   └── requirements.txt
├── frontend/
│   ├── app/            (app)/dashboard, (app)/quotes, (app)/compare, builder, login, register
│   ├── components/
│   ├── lib/
│   ├── tests/
│   └── package.json
├── docs/screenshots/
├── .env.example
├── DECISIONS.md
└── README.md
```

## Tech stack

| Area | Technology |
|---|---|
| Frontend | Next.js, React, TypeScript, CSS |
| Backend | Python, FastAPI, Pydantic, Uvicorn, python-dotenv |
| Auth | PBKDF2, HMAC-signed tokens, environment-based secret |
| Storage | JSON files (catalog, quotes, users); browser localStorage for drafts |
| Testing | pytest, FastAPI TestClient, Vitest, TypeScript type check |
| Deployment | Vercel (frontend), Render (backend), GitHub |

---

# API

Protected quote and stats endpoints need `Authorization: Bearer <token>`. All errors share one shape:

```json
{ "errors": [ { "field": "field_name", "code": "validation_error", "message": "Description of the problem" } ] }
```

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/auth/register` | Create an account |
| POST | `/api/auth/login` | Log in and receive a token |
| GET | `/api/auth/me` | Current user |
| GET | `/api/catalog` | Products, tiers and approval rules |
| POST | `/api/quotes/calculate` | Pricing, approval, explanation and Deal Coach |
| POST | `/api/quotes` | Validate and save a quote |
| GET | `/api/quotes?status=&q=` | List quote summaries |
| GET | `/api/stats` | Dashboard statistics |
| GET | `/api/quotes/export.csv` | Export all quotes as CSV |
| GET | `/api/quotes/{id}/export.csv` | Export one quote as CSV |
| GET | `/api/quotes/compare?a=&b=` | Compare two saved quotes |
| GET | `/api/quotes/{id}` | Quote details and warnings |
| PATCH | `/api/quotes/{id}/status` | Submit, approve or reject (`409` invalid transition, `422` invalid approved discount) |

**Calculate / save request** (`discount_pct` is still accepted as an alias of `proposed_discount_pct`):

```json
{
  "customer_name": "Acme",
  "seats": 50,
  "annual_commitment": false,
  "customer_requested_discount_pct": 25,
  "proposed_discount_pct": 20,
  "lines": [ { "sku": "AGENT-CORE", "quantity": 100 } ]
}
```

**Response (trimmed):**

```json
{
  "tier": "ENTERPRISE",
  "subtotal_cents": 1450000,
  "discount_amount_cents": 290000,
  "total_cents": 1160000,
  "approval_required": true,
  "approval_reasons": ["discount_above_15_percent"]
}
```

**Approve / reject:**

```json
{ "status": "approved", "approved_discount_pct": 15, "comment": "Approved after pricing review." }
{ "status": "rejected", "comment": "Discount exceeds the approved commercial range." }
```

Interactive docs: https://oraczen-deal-desk-quote-simulator.onrender.com/docs

---

# Deployment

**Frontend (Vercel):** set `NEXT_PUBLIC_API_URL=https://oraczen-deal-desk-quote-simulator.onrender.com`.

**Backend (Render):**

| Setting | Value |
|---|---|
| Root directory | `backend` |
| Build command | `pip install -r requirements.txt` |
| Start command | `uvicorn app.main:app --host 0.0.0.0 --port $PORT` |
| Environment | `AUTH_SECRET=<production-secret>`, `CORS_ORIGINS=https://oraczen-deal-desk-quote-simulator.vercel.app` |

---

# Data Persistence and Known Limitations

JSON files are used for persistence, as allowed by the assignment, which keeps setup simple. The storage layer is separate, so it can be replaced later.

- JSON storage is not designed for large-scale concurrent use. A production system would use PostgreSQL for durability, concurrent writes, transactions and search at scale.
- On a free Render plan, services can cold-start and the file system should not be treated as durable across redeploys.
- No external CRM integration, and no real payments (this is a quote simulator).
- Authentication is scoped to this assignment, not enterprise identity management.

# Engineering Decisions

The seven design questions, what I noticed while building, and what I would do with another day are documented in [`DECISIONS.md`](DECISIONS.md).

---

# Author

**Anjali Agarwal** – Computer Science Engineering Student | Full Stack Developer