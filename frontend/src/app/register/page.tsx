"use client";

import Link from "next/link";
import { FormEvent, Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";
import { formatMoney } from "@/lib/format";
import type { ApiEnvelope, Plan } from "@/lib/types";
import { Notice } from "@/components/ui";

export default function RegisterPage() {
  return <Suspense fallback={<div className="screen-center muted">Loading…</div>}><RegisterContent /></Suspense>;
}

function RegisterContent() {
  const searchParams = useSearchParams();
  const requestedPlan = searchParams.get("plan") ?? "";
  const plans = useQuery({
    queryKey: ["public-plans"],
    queryFn: async () => (await apiRequest<ApiEnvelope<Plan[]>>("/plans")).data,
  });
  const defaultPlanId = useMemo(
    () => (plans.data?.some((p) => p.id === requestedPlan) ? requestedPlan : plans.data?.[0]?.id ?? ""),
    [plans.data, requestedPlan],
  );
  const [planId, setPlanId] = useState("");
  const [organizationName, setOrganizationName] = useState("");
  const [adminName, setAdminName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const selectedPlan = plans.data?.find((p) => p.id === (planId || defaultPlanId));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const selectedPlanId = planId || defaultPlanId;
    if (!selectedPlanId) return;
    setError("");
    setSubmitting(true);
    try {
      const response = await apiRequest<ApiEnvelope<{ checkoutUrl: string }>>("/registration/checkout", {
        method: "POST",
        body: JSON.stringify({ organizationName, adminName, adminEmail, password, planId: selectedPlanId }),
      });
      window.location.assign(response.data.checkoutUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to start checkout.");
      setSubmitting(false);
    }
  };

  return (
    <main className="auth-shell wide">
      <section className="auth-card wide-card">
        <div className="split-heading">
          <div>
            <Link href="/" className="sidebar-brand"><span className="brand-mark">TF</span><span>TenantFlow</span></Link>
            <div className="auth-heading"><p className="kicker">Paid onboarding</p><h1>Create your organization</h1><p className="muted">Your organization becomes active only after Stripe confirms payment.</p></div>
          </div>
          {selectedPlan && <div className="selected-plan"><span>{selectedPlan.name}</span><strong>{formatMoney(selectedPlan.priceAmount, selectedPlan.currency)}</strong><small>{selectedPlan.billingInterval.toLowerCase()}</small></div>}
        </div>
        {error && <Notice tone="error">{error}</Notice>}
        <form className="form-grid" onSubmit={submit}>
          <label className="field"><span>Organization name</span><input value={organizationName} onChange={(e) => setOrganizationName(e.target.value)} minLength={2} required /></label>
          <label className="field"><span>Admin name</span><input value={adminName} onChange={(e) => setAdminName(e.target.value)} minLength={2} required /></label>
          <label className="field"><span>Admin email</span><input type="email" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} required /></label>
          <label className="field"><span>Password</span><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} required /></label>
          <label className="field span-2"><span>Plan</span><select value={planId || defaultPlanId} onChange={(e) => setPlanId(e.target.value)} required>{plans.data?.map((plan) => <option key={plan.id} value={plan.id}>{plan.name} · {formatMoney(plan.priceAmount, plan.currency)} / {plan.billingInterval.toLowerCase()}</option>)}</select></label>
          <button className="button span-2" disabled={submitting || plans.isLoading}>{submitting ? "Opening Stripe…" : "Continue to payment"}</button>
        </form>
        <div className="auth-links"><Link href="/login">Already have an account? Sign in</Link></div>
      </section>
    </main>
  );
}
