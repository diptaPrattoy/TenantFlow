"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";
import { formatMoney } from "@/lib/format";
import type { ApiEnvelope, Plan } from "@/lib/types";

export default function Home() {
  const plans = useQuery({
    queryKey: ["public-plans"],
    queryFn: async () => (await apiRequest<ApiEnvelope<Plan[]>>("/plans")).data,
  });

  return (
    <main className="marketing-shell">
      <header className="marketing-header">
        <Link href="/" className="sidebar-brand">
          <span className="brand-mark">TF</span>
          <span>TenantFlow</span>
        </Link>
        <div className="header-actions">
          <Link className="button secondary" href="/login">Sign in</Link>
          <Link className="button" href="/register">Start subscription</Link>
        </div>
      </header>

      <section className="marketing-hero">
        <p className="kicker">Multi-tenant subscription management</p>
        <h1>One platform. Separate organizations. Clean billing.</h1>
        <p className="lead">
          TenantFlow gives each organization its own users, subscription and payment
          history while platform administrators keep a complete operational view.
        </p>
        <div className="hero-actions">
          <Link className="button" href="/register">Create an organization</Link>
          <Link className="button secondary" href="/login">Sign in</Link>
        </div>
      </section>

      <section className="section-block" id="plans">
        <div className="section-heading">
          <div>
            <p className="kicker">Plans</p>
            <h2>Choose a subscription</h2>
          </div>
          <p className="muted">Checkout is handled securely by Stripe.</p>
        </div>
        <div className="plan-grid">
          {plans.isLoading && <div className="panel muted">Loading plans…</div>}
          {plans.data?.map((plan) => (
            <article className="plan-card" key={plan.id}>
              <div>
                <p className="kicker">{plan.billingInterval}</p>
                <h3>{plan.name}</h3>
                <p className="muted">{plan.description || "Subscription plan"}</p>
              </div>
              <div className="plan-price">
                {formatMoney(plan.priceAmount, plan.currency)}
                <span> / {plan.billingInterval.toLowerCase()}</span>
              </div>
              <ul className="feature-list">
                {Object.entries(plan.features).map(([key, value]) => (
                  <li key={key}><strong>{key}</strong><span>{String(value)}</span></li>
                ))}
              </ul>
              <Link className="button full" href={`/register?plan=${plan.id}`}>
                Select {plan.name}
              </Link>
            </article>
          ))}
          {plans.isError && <div className="notice error">Unable to load plans.</div>}
        </div>
      </section>
    </main>
  );
}
