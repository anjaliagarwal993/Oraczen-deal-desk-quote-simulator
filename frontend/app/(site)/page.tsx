import Link from "next/link";

// Landing page (server component, no state). Static marketing text only;
// the example visuals are illustrations, not live data.
export default function Home() {
  return (
    <div className="lp">
      <header className="lp-nav">
        <Link className="lp-logo" href="/"><span className="brand-mark" aria-hidden="true">◈</span> Deal Desk</Link>
        <nav className="lp-links" aria-label="Sections"><a href="#features">Features</a><a href="#negotiation">Negotiation</a><a href="#how">How it works</a><a href="#tiers">Pricing rules</a><a href="#faq">FAQ</a></nav>
        <div className="lp-actions"><Link className="lp-btn ghost" href="/login">Log in</Link><Link className="lp-btn solid" href="/register">Get started</Link></div>
      </header>

      <section className="lp-hero">
        <div className="lp-copy">
          <p className="lp-eyebrow">DEAL INTELLIGENCE FOR SALES AND FINANCE</p>
          <h1>Price the deal. Know if it needs approval. Before you send it.</h1>
          <p className="lp-sub">Deal Desk calculates every quote on the server, shows where the customer’s ask sits against policy, and tells your rep exactly why a deal needs a manager’s sign-off.</p>
          <div className="lp-cta">
            <Link className="lp-btn solid big" href="/register">Create your free account</Link>
            <Link className="lp-btn ghost big" href="/login">Log in</Link>
          </div>
          <ul className="lp-proof"><li>Totals calculated by the API</li><li>Every status change recorded</li><li>CSV and PDF export</li></ul>
        </div>
        <div className="lp-quote" aria-label="Example quote">
          <div className="lp-q-head"><b>Example quote · Northwind Traders</b><span className="lp-pill warn">⚠ Approval required</span></div>
          <div className="lp-neg"><div><small>Customer asked</small><b>22%</b></div><div><small>Your proposal</small><b>18%</b></div><div><small>Gap</small><b className="amber">4 pp</b></div></div>
          <div className="lp-bar"><span>Customer request</span><i><u className="w100 grey" /></i><b>22%</b></div>
          <div className="lp-bar"><span>Your proposal</span><i><u className="w82 ind" /></i><b>18%</b></div>
          <div className="lp-bar"><span>Policy maximum</span><i><u className="w91 lav" /></i><b>20%</b></div>
          <div className="lp-q-row muted"><span>Subtotal</span><span>$13,700</span></div>
          <div className="lp-q-row muted"><span>Discount 18%</span><span>−$2,466</span></div>
          <div className="lp-q-row total"><span>Total</span><span>$11,234</span></div>
          <div className="lp-tip"><b>✦ Deal Coach</b> Lowering the discount to 15% removes the approval requirement.</div>
        </div>
      </section>

      <section className="lp-section" id="features">
        <div className="lp-head">
          <p className="lp-eyebrow">FEATURES</p>
          <h2>Everything a rep needs to send a quote with confidence</h2>
          <p>From the first seat count to the final approved total, every step is calculated, explained and recorded.</p>
        </div>
        <div className="lp-grid">
          <div className="lp-card"><span className="lp-ico">◈</span><h3>Live pricing</h3><p>Change seats, products or discount and the totals update as you type, straight from the pricing engine.</p></div>
          <div className="lp-card"><span className="lp-ico">⇄</span><h3>Negotiation view</h3><p>Customer request, your proposal and the policy maximum on one scale, so the gap is obvious.</p></div>
          <div className="lp-card"><span className="lp-ico">⚠</span><h3>Clear approval reasons</h3><p>Each reason is listed with its threshold, so nobody has to guess why a deal is blocked.</p></div>
          <div className="lp-card"><span className="lp-ico">✦</span><h3>Deal Coach</h3><p>Rule-based tips such as how many seats away the next tier is. Deterministic and explainable.</p></div>
          <div className="lp-card"><span className="lp-ico">↺</span><h3>What-if options</h3><p>Preview how lowering the discount or dropping annual commitment removes approval, then apply it in one click.</p></div>
          <div className="lp-card"><span className="lp-ico">⧉</span><h3>Compare scenarios</h3><p>Duplicate a quote, change one thing, and see the difference in total, discount and approval side by side.</p></div>
          <div className="lp-card"><span className="lp-ico">≡</span><h3>Audit trail</h3><p>Draft, submitted, approved or rejected. Invalid jumps are blocked and every change is timestamped.</p></div>
          <div className="lp-card"><span className="lp-ico">⤓</span><h3>CSV and PDF export</h3><p>Download any quote or the whole list as CSV, and print a clean quote document or save it as a PDF.</p></div>
        </div>
      </section>

      <section className="lp-section alt" id="negotiation">
        <div className="lp-split">
          <div>
            <p className="lp-eyebrow">NEGOTIATION</p>
            <h2>See the customer’s ask against your policy</h2>
            <p className="lp-lead">The customer’s requested discount is information only. Your proposed discount drives the price and the approval, and a manager’s approved discount is kept separately in the record.</p>
            <ul className="lp-ticks"><li>Gaps shown in percentage points</li><li>Tier maximum on the same scale</li><li>Requested, proposed and approved never get mixed up</li></ul>
          </div>
          <div className="lp-panel" aria-label="Example negotiation">
            <div className="lp-neg"><div><small>Customer asked</small><b>22%</b></div><div><small>Your proposal</small><b>18%</b></div><div><small>Gap</small><b className="amber">4 pp</b></div></div>
            <div className="lp-bar"><span>Customer request</span><i><u className="w100 grey" /></i><b>22%</b></div>
            <div className="lp-bar"><span>Your proposal</span><i><u className="w82 ind" /></i><b>18%</b></div>
            <div className="lp-bar"><span>Policy maximum</span><i><u className="w91 lav" /></i><b>20%</b></div>
            <p className="lp-panel-note">Customer asked for 4 percentage points more.</p>
          </div>
        </div>
      </section>

      <section className="lp-section">
        <div className="lp-split rev">
          <div>
            <p className="lp-eyebrow">APPROVAL</p>
            <h2>Approval status you can’t miss</h2>
            <p className="lp-lead">A clear banner tells the rep whether the quote is ready or needs a manager, lists every reason, and offers what-if options that show how to remove the need for approval.</p>
            <ul className="lp-ticks"><li>Every reason shown next to its threshold</li><li>Preview an option before you apply it</li><li>Manager decisions saved in the history</li></ul>
          </div>
          <div className="lp-banner-demo" aria-label="Example approval banners">
            <div className="banner needed"><b>⚠ APPROVAL REQUIRED</b><p>This quote needs manager approval.</p><ul><li>Proposed discount is above 15%.</li></ul></div>
            <div className="banner ready"><b>✓ READY TO QUOTE</b><p>This quote currently satisfies approval requirements.</p></div>
          </div>
        </div>
      </section>

      <section className="lp-section alt" id="how">
        <div className="lp-head">
          <p className="lp-eyebrow">HOW IT WORKS</p>
          <h2>From first draft to decision in three steps</h2>
        </div>
        <ol className="lp-steps">
          <li><b>Build the quote</b><span>Add the customer, seats and products. Validation tells you what to fix in plain language.</span></li>
          <li><b>Check the approval</b><span>See the tier, the total and whether sign-off is needed, with the reasons.</span></li>
          <li><b>Save and review</b><span>Submit it, and a manager approves or rejects with the full history in view.</span></li>
        </ol>
      </section>

      <section className="lp-section" id="tiers">
        <div className="lp-head">
          <p className="lp-eyebrow">PRICING RULES</p>
          <h2>The rules, in the open</h2>
          <p>Seats decide the tier and its maximum discount. Quantity decides the price.</p>
        </div>
        <div className="lp-tiers">
          <div className="lp-tier"><b>Starter</b><span>1 to 9 seats</span><em>up to 10% off</em></div>
          <div className="lp-tier"><b>Growth</b><span>10 to 49 seats</span><em>up to 20% off</em></div>
          <div className="lp-tier"><b>Enterprise</b><span>50+ seats</span><em>up to 30% off</em></div>
        </div>
        <p className="lp-note">Approval is needed when the discount is above 15%, the total is above $25,000, or an annual commitment comes with a discount above 10%.</p>
      </section>

      <section className="lp-section alt" id="faq">
        <div className="lp-head">
          <p className="lp-eyebrow">FAQ</p>
          <h2>Questions people ask</h2>
        </div>
        <div className="lp-faq">
          <details><summary>Does the customer’s requested discount change the price?</summary><p>No. It is recorded for the negotiation view only. The proposed discount controls pricing and approval.</p></details>
          <details><summary>Who calculates the totals?</summary><p>The server. The browser only displays what the API returns, so every screen shows the same numbers.</p></details>
          <details><summary>Can I export a quote?</summary><p>Yes. Download any quote or the full list as CSV, or use Print / Save as PDF for a clean quote document.</p></details>
          <details><summary>What happens after I submit a quote?</summary><p>A manager reviews it, can approve a lower discount or reject it with a reason, and every step is saved in the history.</p></details>
        </div>
      </section>

      <section className="lp-band">
        <h2>Ready to stop calculating quotes by hand?</h2>
        <p>Create an account and build your first quote in minutes.</p>
        <Link className="lp-btn solid big" href="/register">Create your free account</Link>
      </section>

      <footer className="lp-footer">
        <div className="lp-footgrid">
          <div><Link className="lp-logo" href="/"><span className="brand-mark" aria-hidden="true">◈</span> Deal Desk</Link><p>Quote pricing, approval rules and audit history in one place.</p></div>
          <div><b>Product</b><a href="#features">Features</a><a href="#negotiation">Negotiation</a><a href="#tiers">Pricing rules</a><a href="#faq">FAQ</a></div>
          <div><b>Account</b><Link href="/login">Log in</Link><Link href="/register">Create account</Link></div>
        </div>
        <div className="lp-footbase"><span>© Deal Desk Quote Simulator</span><span>Prepared for the Oraczen take-home assignment</span></div>
      </footer>
    </div>
  );
}
