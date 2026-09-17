"use client";

import Link from "next/link";
import { FormEvent, Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { apiRequest } from "@/lib/api";
import { Notice } from "@/components/ui";

export default function AcceptInvitationPage() {
  return <Suspense fallback={<div className="screen-center muted">Loading…</div>}><AcceptInvitationContent /></Suspense>;
}

function AcceptInvitationContent() {
  const token = useSearchParams().get("token") ?? "";
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const submit = async (event: FormEvent) => { event.preventDefault(); setError(""); try { const response = await apiRequest<{ message?: string }>(`/invitations/${encodeURIComponent(token)}/accept`, { method: "POST", body: JSON.stringify({ name, password }) }); setMessage(response.message ?? "Invitation accepted."); } catch (err) { setError(err instanceof Error ? err.message : "Unable to accept invitation."); } };
  return <main className="auth-shell"><section className="auth-card"><Link href="/" className="sidebar-brand"><span className="brand-mark">TF</span><span>TenantFlow</span></Link><div className="auth-heading"><p className="kicker">Organization invitation</p><h1>Finish your account</h1></div>{!token && <Notice tone="error">This invitation link is missing a token.</Notice>}{message && <Notice tone="success">{message} <Link href="/login">Sign in</Link></Notice>}{error && <Notice tone="error">{error}</Notice>}<form className="form-stack" onSubmit={submit}><label className="field"><span>Name</span><input value={name} onChange={(e) => setName(e.target.value)} minLength={2} required /></label><label className="field"><span>Password</span><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} required /></label><button className="button" disabled={!token}>Accept invitation</button></form></section></main>;
}
