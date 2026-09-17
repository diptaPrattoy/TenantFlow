"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { apiRequest } from "@/lib/api";
import { Notice } from "@/components/ui";
import type { ApiEnvelope } from "@/lib/types";

type StatusData = { id: string; status: string; organizationCreated: boolean };

export default function CheckoutSuccessPage() {
  return <Suspense fallback={<div className="screen-center muted">Loading…</div>}><CheckoutSuccessContent /></Suspense>;
}

function CheckoutSuccessContent() {
  const registrationId = useSearchParams().get("registration_id") ?? "";
  const [status, setStatus] = useState<StatusData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!registrationId) return;
    let active = true;
    let attempts = 0;
    const check = async () => {
      try {
        const response = await apiRequest<ApiEnvelope<StatusData>>(`/registration/${registrationId}/status`);
        if (!active) return;
        setStatus(response.data);
        if (response.data.status !== "COMPLETED" && attempts < 10) {
          attempts += 1;
          window.setTimeout(check, 1500);
        }
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : "Unable to confirm registration.");
      }
    };
    void check();
    return () => { active = false; };
  }, [registrationId]);

  return <main className="auth-shell"><section className="auth-card"><div className="success-icon">✓</div><div className="auth-heading"><p className="kicker">Payment received</p><h1>Finishing your account</h1><p className="muted">TenantFlow waits for Stripe’s verified webhook before activating your organization.</p></div>{error && <Notice tone="error">{error}</Notice>}{status?.status === "COMPLETED" ? <><Notice tone="success">Organization activated successfully.</Notice><Link className="button full" href="/login">Sign in to TenantFlow</Link></> : <Notice>Confirmation status: {status?.status ?? "Checking…"}</Notice>}</section></main>;
}
