# Decisions

## The seven questions and answers
**1. What happens if the same product is added twice?**

AGENT-CORE × 10
AGENT-CORE × 5

would become:

AGENT-CORE × 15
Why?

The SKU uniquely identifies a product in the catalog. Keeping one line per SKU makes the quote easier to understand and avoids duplicate product rows during pricing, export, and comparison.

It also makes the quote cleaner for a salesperson or manager reviewing it.


**2. Is a 0% discount represented as 0 or omitted?**

I decided to represent a 0% discount explicitly as 0.

For example:

{
  "proposed_discount_pct": 0
}
Why?

A 0% discount is a valid business value. It means that the salesperson is intentionally offering no discount.

If the value were omitted, it would be unclear whether:

the salesperson selected 0%, or
the value was never provided.

Representing it explicitly as 0 makes the API and stored quote data unambiguous and keeps the pricing calculation consistent.


**3. How do you handle money and rounding?**

I decided to represent monetary values internally as integer cents instead of floating-point dollar values.

For example:

$1,450.00 → 145000 cents

The API therefore uses fields such as:

subtotal_cents
discount_amount_cents
total_cents
Why?

Floating-point arithmetic can introduce precision issues when dealing with financial calculations.

Since this application is calculating customer quotes, I wanted the same input to always produce the same monetary result.

The calculation follows:

Line Total = Quantity × Unit Price

Subtotal = Sum of Line Totals

Discount Amount = Subtotal × Discount %

Total = Subtotal - Discount Amount

The backend controls the monetary calculation and rounding so that the frontend does not independently calculate a different final amount.

Trade-off

Using integer cents makes the backend calculation reliable, but the frontend has to convert cents into dollars when displaying prices.

I consider this a worthwhile trade-off because correctness is more important than keeping the internal representation visually convenient.


**4. Does annual commitment change pricing, or only approval logic?**

Annual commitment affects approval logic only. It does not automatically change the price.

For example:

annual_commitment = true

does not automatically apply an additional discount.

Instead, it is part of the approval rule:

Annual commitment = true
AND
Proposed discount > 10%

requires approval.

Why?

The requirements define annual commitment as an approval condition but do not specify an automatic price reduction.

I therefore did not introduce an additional pricing rule that was not part of the requirements.

This keeps the two concepts separate:

Pricing
→ products + quantities + proposed discount

Approval
→ proposed discount + total value + annual commitment

This also makes the system easier to explain to a salesperson.


**5. What happens if a product disappears from the catalog after a saved quote was created?**

A saved quote should remain understandable even if the product later disappears from the current catalog.

I decided to preserve the product information that was used when the quote was created rather than depending completely on the current catalog.

If the current catalog no longer contains that product, the application can show a catalog-drift warning instead of silently deleting or replacing the old quote line.

For example:

Saved quote:
AGENT-CORE
Original unit price: $120

Current catalog:
AGENT-CORE is no longer available
Why?

A saved quote represents a historical sales decision. It should not become invalid or unreadable just because the catalog changes later.

At the same time, the user should know that the saved quote and the current catalog are no longer completely aligned.

Therefore, I prefer:

Preserve historical quote
+
Warn about catalog drift

instead of silently changing the historical quote.


**6. Where should business rules live so the frontend and backend cannot disagree?**

The backend is the authoritative source for pricing and business rules.

The FastAPI backend is responsible for:

Pricing calculations
Tier determination
Discount validation
Maximum discount validation
Approval rules
Quote validation
Quote workflow transitions

The frontend requests the calculation from the backend and displays the returned result.

The flow is:

Frontend
   ↓
POST /api/quotes/calculate
   ↓
FastAPI Backend
   ↓
Pricing + Validation + Approval Rules
   ↓
Calculation Result
   ↓
Frontend
Why?

If the frontend and backend independently implemented the same business rules, they could eventually disagree.

For example:

Frontend:
20% discount is acceptable

Backend:
20% discount requires approval

That would create inconsistent behavior.

The backend therefore acts as the single source of truth.

I also separated the backend logic into modules such as:

pricing.py
workflow.py
explain.py
storage.py
main.py

This keeps business rules separate from API routing and makes them easier to test.


**7. Which status transitions are allowed?**

I decided to use the following quote workflow:

Draft
  ↓
Submitted
  ↓
Approved

or:

Draft
  ↓
Submitted
  ↓
Rejected

The allowed transitions are:

| Current Status | Allowed Next Status |
| --- | --- |
| Draft | Submitted |
| Submitted | Approved |
| Submitted | Rejected |
| Approved | No further transition |
| Rejected | No further transition |

Why?

A quote should not be able to move directly from Draft to Approved because it has not gone through the submission process.

Similarly, once a quote has been approved or rejected, allowing arbitrary transitions would make the workflow and approval history harder to understand.

The backend validates these transitions rather than relying only on frontend buttons.

This is important because a user could otherwise call the API directly and bypass frontend restrictions.


**What I Noticed While Building**


**1. Pricing rules and approval rules are different concepts**

One important observation during implementation was that the maximum discount allowed by a pricing tier is not the same thing as the approval threshold.

For example:

Enterprise maximum discount = 30%

Approval threshold = 15%

Proposed discount = 20%

In this case, 20% is valid for the Enterprise tier, but it still requires approval.

This distinction helped keep the pricing validation and approval logic separate.


**2. Customer-requested discount and proposed discount should not be treated as the same value**

During the implementation, I found that the customer's requested discount is mainly negotiation context, while the proposed discount is the actual commercial offer.

For example:

Customer requested = 22%
Salesperson proposed = 18%
Tier maximum = 20%

The customer asking for 22% should not automatically invalidate the quote because the salesperson may choose to offer only 18%.

This made it useful to keep these values separate.


**3. The backend needs to be authoritative**

The project made it clear that calculations shown in the UI should not be treated as the final source of truth.

The frontend can provide a good user experience, but the backend must validate the final values before saving a quote.

This is especially important for:

Discounts
Pricing
Approval rules
Quote status


**4. Explainability is important for a sales tool**

Instead of only showing:

Approval Required

the application explains why approval is required.

For example:

Discount exceeds the 15% approval threshold.

or:

Quote total exceeds $25,000.

This makes the tool more useful than a simple calculator because the salesperson can understand what action is causing the approval requirement.


**5. Scenario comparison is more useful when the differences are explained**

While implementing the comparison feature, I found that simply showing two quotes side by side is not enough.

The application therefore also provides a summary of what changed between Scenario A and Scenario B.

This makes the comparison more useful for evaluating negotiation alternatives.


**6. Historical quote data and current catalog data are different**

A saved quote represents what was known when the quote was created, while the catalog represents the current product information.

Keeping this distinction allowed me to introduce catalog-drift warnings instead of silently modifying old quotes.


**7. JSON persistence is simple but has clear limitations**

JSON files were sufficient for the assignment and made local setup very simple.

However, while building the application, it became clear that a real production system would eventually need a database for:

Concurrent users
Reliable persistence
Transactions
Searching and filtering at scale
Better data consistency

I therefore kept the storage layer separate so that it can be replaced later.


**What I Would Do With Another Day**

If I had another day, I would focus on improvements that would make the application more production-ready rather than adding unrelated features.


**1. Add a database**

I would replace JSON persistence with PostgreSQL.

This would improve:

Concurrent quote creation
Data durability
Querying
Transactions
Scalability

The current storage layer is already separated, so the pricing and workflow logic would not need to be redesigned completely.


**2. Add stronger role-based access**

I would introduce separate roles such as:

Sales Representative
Manager
Admin

For example:

Sales representatives could create and submit quotes.
Managers could approve or reject quotes.
Admins could manage catalog information and users.

This would make the approval workflow closer to a real internal sales system.


**3. Add end-to-end testing**

The current project has backend and frontend tests.

With another day, I would add end-to-end tests for complete workflows such as:

Register
→ Login
→ Create Quote
→ Calculate
→ Save
→ Submit
→ Approve

I would also test the comparison workflow and catalog-drift scenarios end to end.


**4. Improve catalog versioning**

Currently, catalog drift can be detected and surfaced to the user.

A stronger production implementation would version the catalog so that every quote could explicitly reference the catalog version used when it was created.

For example:

Quote #101
Catalog Version: 2026.09

This would make historical pricing easier to audit.


**5. Add approval notifications**

I would add email or internal notifications when a quote is submitted for approval.

For example:

Sales Representative
        ↓
Submit Quote
        ↓
Manager Notification
        ↓
Approve / Reject
        ↓
Sales Representative Notification

This would make the workflow more practical for a real sales team.


**6. Add CI/CD**

I would configure GitHub Actions to automatically:

Run backend tests
Run frontend tests
Run TypeScript checks
Build the frontend
Validate the project before merging

This would reduce the chance of deploying code that breaks an existing feature.


**7. Improve production monitoring**

For a production deployment, I would add structured logging and monitoring for:

API errors
Authentication failures
Quote calculation failures
Approval workflow errors
Application performance

This would make production issues easier to identify and debug.

