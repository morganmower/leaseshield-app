import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import "./landing.css";

export default function Landing() {
  return (
    <div className="landing-app">
      {/* Header */}
      <header className="landing-header">
        <div className="header-content">
          <div className="logo-text">LeaseShield App</div>
          <ThemeToggle />
        </div>
      </header>

      {/* HERO */}
      <section className="hero">
        <div className="container">
          <h1>Stop One Bad Lease From Costing You $10,000+ in 2025</h1>
          <p className="big">
            Updated Texas & Utah leases · Eviction-ready notices · Credit decoder that spots the red flags that actually matter — all inside <strong>LeaseShield App</strong>.
          </p>
          <div className="price">$10/month forever – only for the first 200 founders</div>

          <div className="calc-box">
            One bad eviction in Texas averages <b>$8,400</b> (court + lost rent + damages).<br />
            LeaseShield App = <b>$120/year</b> insurance.
          </div>

          <Link to="/subscribe">
            <Button size="lg" className="stripe-button">
              Start 7-Day Free Trial → $10/mo after
            </Button>
          </Link>
          <p className="small">No setup fee • Cancel anytime • Powered by Stripe</p>
        </div>
      </section>

      {/* DISCLAIMER */}
      <div className="disclaimer">
        <strong>Important:</strong> These are general templates based on current state laws. This is not legal advice. Always have your final documents reviewed by a licensed attorney.
      </div>

      {/* TRUST BADGES */}
      <div className="trust">
        <p>Trusted by landlords in</p>
        <div className="badges">
          <span className="big-number">200+</span>
          <p>Active landlords already protected</p>
        </div>
      </div>

      {/* PROBLEMS */}
      <section className="section">
        <div className="container">
          <h2>One bad lease can cost you $10,000+ in 2025</h2>
          <div className="cards">
            <div className="card-item">Missing new ESA / assistance-animal rules</div>
            <div className="card-item">Adverse-action letters that violate FCRA</div>
            <div className="card-item">Paying $500+ every time you need a lawyer</div>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="section light">
        <div className="container">
          <h2>Everything inside LeaseShield App</h2>
          <div className="features">
            <div className="feature-item">2025 lease agreements (UT • TX • ND • SD)</div>
            <div className="feature-item">Late rent, violation & eviction notices</div>
            <div className="feature-item">Move-in/move-out checklists</div>
            <div className="feature-item">Credit report decoder (what really matters)</div>
            <div className="feature-item">Only the legal updates that create liability</div>
            <div className="feature-item">Monthly live Q&A (recorded forever)</div>
          </div>

          <div className="cta-center">
            <p className="urgent">Price jumps to $15 forever in a few days</p>
            <Link to="/subscribe">
              <Button size="lg" className="stripe-button large">
                Yes – Lock In $10/mo Forever
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* TESTIMONIAL */}
      <section className="section">
        <div className="container center">
          <p className="quote">
            "The credit decoder alone saved me from renting to someone with four hidden evictions. That's $12k I didn't lose."
          </p>
          <p><strong>— Derek M., 34 units in Austin</strong></p>
        </div>
      </section>

      {/* FINAL SCARCITY */}
      <div className="scarcity">
        <p className="urgent">Only 43 founders spots left at $10/mo forever<br />(price increases to $15 next week)</p>
        <Link to="/subscribe">
          <Button size="lg" className="stripe-button large">
            Lock In My Spot Before It's Gone
          </Button>
        </Link>
        <p className="guarantee">7-day free trial • Instant access • Cancel anytime • Full refund if it's not worth 10× the price</p>
      </div>

      {/* FOOTER */}
      <footer className="landing-footer">
        © 2025 LeaseShield App • Built by Western Verify • hello@leaseshieldapp.com
      </footer>
    </div>
  );
}
