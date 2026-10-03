# Deal Desk Quote Simulator

## Overview

Deal Desk Quote Simulator is a full-stack internal sales tool designed to help sales representatives create, evaluate, compare, and manage customer quotes.

The application allows sales representatives to select products, configure seat quantities, manage customer and proposed discounts, calculate pricing, understand the applicable pricing tier, and immediately identify whether a quote requires approval and why.

The application goes beyond basic quote calculation by providing negotiation intelligence, Deal Coach recommendations, what-if analysis, approval workflows, quote history, dashboard analytics, scenario comparison, draft recovery, CSV export, print-friendly quote review, and catalog-drift warnings.

The project is built using a **Next.js + React + TypeScript frontend** and a **Python + FastAPI backend**, communicating through REST APIs. Pricing and approval rules are calculated and validated on the backend.

---

# Live Demo

### Frontend

https://oraczen-deal-desk-quote-simulator.vercel.app

### Backend API

https://oraczen-deal-desk-quote-simulator.onrender.com

### API Documentation

https://oraczen-deal-desk-quote-simulator.onrender.com/docs

### GitHub Repository

https://github.com/anjaliagarwal993/Oraczen-deal-desk-quote-simulator

---

## Landing Page

The landing page introduces the Deal Desk workflow and demonstrates how the system compares the customer's requested discount, salesperson's proposal, and policy maximum while explaining approval requirements.

<img width="1897" height="842" alt="Screenshot 2026-10-04 005517" src="https://github.com/user-attachments/assets/75bb18a9-05db-4990-abb6-f47db0617357" />

---

## Feature Overview

The application provides sales-focused capabilities including live pricing, negotiation visibility, approval explanations, Deal Coach recommendations, what-if analysis, and scenario comparison.

<img width="1886" height="858" alt="Screenshot 2026-10-04 005556" src="https://github.com/user-attachments/assets/5946a537-f9b6-4e2b-bd27-b0e96672d950" />

---

## Dashboard

The dashboard provides an overview of quote activity, open pipeline value, approved value, deals waiting for approval, quote status distribution, deal health, and recent quote activity.

<img width="1897" height="817" alt="Screenshot 2026-10-04 010056" src="https://github.com/user-attachments/assets/54799e4e-bedf-4e4e-bf68-3f5380ccebef" />
<img width="1871" height="433" alt="Screenshot 2026-10-04 010116" src="https://github.com/user-attachments/assets/bbae81e1-bd8b-4f46-aee5-e8be5119f949" />


---

## Saved Quotes & Quote Activity

Users can view saved quotes, monitor their current status, search and filter quotes, and access individual quote details.

<img width="1885" height="767" alt="Screenshot 2026-10-04 010759" src="https://github.com/user-attachments/assets/e5e69930-c1d9-40d9-97bc-add0d6fe1fd5" />


---

## Compare Scenarios

Users can select two saved quotes and compare them to understand exactly what changed between the two scenarios.

The comparison highlights differences in pricing, seats, discounts, products, commitment type, and approval requirements.

<img width="1881" height="858" alt="Screenshot 2026-10-04 010147" src="https://github.com/user-attachments/assets/51743d0c-c26f-4ed5-8232-9ec7b9ca8441" />


---

## Side-by-Side Quote Analysis

The detailed comparison view provides a side-by-side analysis of both scenarios, including approval reasons, pricing tiers, discount limits, negotiation information, and quote line items.
<img width="1865" height="832" alt="Screenshot 2026-10-04 010336" src="https://github.com/user-attachments/assets/a41a53d0-2d2e-4611-a4cb-1eff8ed4ca4e" />
<img width="1861" height="861" alt="Screenshot 2026-10-04 010228" src="https://github.com/user-attachments/assets/6ac049d7-5713-405d-ad68-a5d88dd15108" />

---

# Features

## Authentication & Authorization

- User registration and login
- Secure password hashing using PBKDF2
- HMAC-signed authentication tokens
- Token expiration
- Protected application routes
- Authenticated API requests

---

## Quote Builder

The Quote Builder is the primary workflow for creating customer quotes.

Sales representatives can:

- Select products from the catalog
- Add multiple products and quantities
- Configure customer-requested discount
- Configure proposed salesperson discount
- Select annual commitment
- Calculate pricing through the backend
- View approval requirements before saving
- Save quotes for later review

---

## Tier-Based Pricing

The application automatically determines the customer's pricing tier based on the number of seats.

| Seats | Tier | Maximum Discount |
|------:|------|-----------------:|
| 1–9 | STARTER | 10% |
| 10–49 | GROWTH | 20% |
| 50+ | ENTERPRISE | 30% |

The proposed discount is validated against the maximum discount allowed for the applicable tier.

---

## Pricing & Approval Engine

The backend acts as the authoritative source for pricing and approval calculations.

For every quote:

```text
Line Total = Quantity × Unit Price

Subtotal = Sum of all line totals

Discount Amount = Subtotal × Discount %

Total = Subtotal − Discount Amount
