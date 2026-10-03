# Decisions

## The seven questions
1. **Same product added twice?** The backend merges them into one line and adds the quantities (2 + 3 → 5). One line per SKU keeps the quote readable and the totals identical either way. Tested in `test_same_product_twice_is_merged`.
2. **0% discount: `0` or omitted?** Always stored and returned as the number `0`. A missing field and "no discount" mean different things; a number is never ambiguous, and the type stays simple.
3. **Money and rounding.** Money is **integer cents** end to end; discount percentages are Python `Decimal`. Floats cannot represent most decimals exactly (`0.1 + 0.2 != 0.3`), so totals could drift by a cent. The only rounding step is `discount_amount`, rounded **half-up** to the cent; total = subtotal − discount_amount, so the lines on the screen always add up. Frontend only formats cents for display.
4. **Annual commitment: pricing or approval?** Approval only. It never changes a price; it lowers the discount that triggers approval from "above 15%" to "above 10%". The explanation text says this explicitly.
5. **Product removed from the catalog after saving?** Each saved quote stores a **snapshot** (name, unit price, line total). Old quotes keep their original numbers. The API adds a `warnings` entry ("no longer in the catalog" / "price has changed") which the review page shows. Quotes are never silently recalculated.
6. **Where do the rules live?** Only in `backend/app/pricing.py` (+ `workflow.py` for statuses). The frontend never computes a total, tier, approval flag or allowed transition; it sends a draft and renders the response. The approval meters only scale numbers the API returned. Tier ranges are read from `catalog.json`, not hardcoded.
7. **Status transitions.** `draft → submitted → approved` and `draft → submitted → rejected`. Approved and rejected are final; no skipping `submitted`, no going back. Invalid moves return **409** with the allowed next statuses. Each change is appended to a history list (audit trail).

## Discount negotiation and approval
1. **Why the requested discount does not affect pricing.** It is what the customer *wants*, not what we *offer*. If it fed the total, a customer could change a price just by asking. It is stored and shown (with the gap in percentage points) purely as negotiation context.
2. **Why the proposed discount controls the quote.** It is the only discount the salesperson commits to, so `discount_amount`, `total`, tier validation, the approval rules and the Deal Coach all read it. `discount_pct` was renamed to `proposed_discount_pct`; the old name is still accepted on input as an alias.
3. **Why approval uses the proposed discount.** Approval exists to control what we give away. A customer asking for 25% while we propose 15% gives nothing away, so no approval. Exactly 15% is still not "above 15%".
4. **Why the request may exceed the tier maximum.** The tier maximum is a limit on *our* offer, not on what customers may ask. Rejecting the quote would punish the rep for the customer's ambition. The UI instead says the request is above the tier limit but the proposal is within policy. Only the request being outside 0-100 is an error.
5. **How the approved discount works.** It stays empty ("Pending") until a manager approves. Then it is stored separately, with its own `discount_amount` and **final approved total**; the proposed figures are never overwritten. It must be 0-100, within the tier maximum, and not above the proposal. If the manager approves without typing a value it is recorded as equal to the proposal (explicitly stored, and noted in the history). It can only be set while approving, never on reject or submit.
6. **Can approved exceed proposed? No.** Nothing in the brief supports manager-approved *increases*, and a manager raising a discount above what the rep asked for would also skip the rep's own commitment. Approval can only hold or reduce the discount. If the business wants increases later, relax `validate_approved` (one function, one test).
7. **Old `discount_pct` records.** On read, `normalize_quote` maps `discount_pct` to `proposed_discount_pct`, and fills "no request / no approval" for the rest. Nothing is rewritten on disk, nothing becomes invalid, and the function is idempotent.
8. **Money and rounding (unchanged).** Integer cents; percentages are `Decimal`; the only rounding is `apply_discount` (half-up to the cent). The approved figures use the same function, so the proposed and approved totals round identically.
9. **Requested discount is optional** (`null` = not entered), not defaulting to 0, so we never claim "you are offering 15 points more than requested" when nobody entered a request.
10. **What-if options are simulations.** Each re-runs `calculate()` on a copy of the draft; the UI only changes the form if the rep presses Apply. The "reduce the total" option has no Apply button because there is no single correct way to trim scope.
11. **Approval logic is a pure function** (`workflow.apply_status_change`): it validates first and mutates second, so a rejected approval changes nothing, and it can be unit-tested without a web server.
12. **API field name:** the tier maximum is still returned as `tier_max_discount_pct` (it existed before this change; the catalog rules use `max_discount_pct`).

## Things I noticed
- **README example vs. rule text:** the example response lists `discount_above_15_percent` for a 15% discount on $12,000, but the rule says "*above* 15%". I followed the rule: exactly 15% does **not** need approval. Same for exactly $25,000. Both boundaries are tested.
- **STARTER can never trigger the 15% rule** (max 10%), so "above 15%" only occurs for GROWTH/ENTERPRISE. Tested.
- **Seats vs quantity:** seats decide the tier (max discount); line quantity decides the price. They are independent.
- Several approval reasons can apply at once (e.g. 18% with annual commitment); all are listed.
- Validation collects *every* problem and returns them together, with plain-language messages.
- Quantity is capped at 100,000 as a typo guard (my choice, not in the spec).

## Testing notes
- Backend: business rules and boundaries (9/10, 49/50, 99999/100000, 15%, $25,000), rounding, validation, API errors, status workflow, catalog drift.
- Frontend: `formatMoney` and the `isDraft` localStorage guard. With more time I'd add React Testing Library tests for the builder (error rendering, debounce) and a Playwright happy-path.

## Limitations
- JSON file storage: single process, whole-file rewrite on each save (lock + atomic replace). Fine for a demo, not for concurrent users.
- Login exists (register/login, signed tokens), but every signed-in user can approve or reject any quote. In production, approving would need a manager role, and the token would live in an httpOnly cookie rather than localStorage.

## With another day
- PostgreSQL (`quotes`, `quote_lines`, `status_history` tables; snapshot columns stay) with Alembic migrations.
- Roles: reps submit, managers approve.
- Optimistic status updates with rollback, Docker Compose, and a React Testing Library suite.
- Optimistic concurrency (version field) so two reviewers can't overwrite each other.
