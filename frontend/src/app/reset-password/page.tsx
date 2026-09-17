"use client";

import Link from "next/link";
import { FormEvent, Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { apiRequest } from "@/lib/api";
import { Notice } from "@/components/ui";

export default function ResetPasswordPage() {
  return <Suspense fallback={<div className="screen-center muted">Loading…</div>}><ResetPasswordContent /></Suspense>;
}

function ResetPasswordContent() {
  const token = useSearchParams().get("token") ?? "";
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const submit = async (event: FormEvent) => { event.preventDefault(); setError(""); try { const response = await apiRequest<{ message?: string }>("/auth/reset-password", { method: "POST", body: JSON.stringify({ token, password }) }); setMessage(response.message ?? "Password reset successfully."); } catch (err) { setError(err instanceof Error ? err.message : "Unable to reset password."); } };
  return <main className="auth-shell"><section className="auth-card"><Link href="/" className="sidebar-brand"><span className="brand-mark">TF</span><span>TenantFlow</span></Link><div className="auth-heading"><p className="kicker">Account recovery</p><h1>Choose a new password</h1></div>{!token && <Notice tone="error">This reset link is missing a token.</Notice>}{message && <Notice tone="success">{message} <Link href="/login">Sign in</Link></Notice>}{error && <Notice tone="error">{error}</Notice>}<form className="form-stack" onSubmit={submit}><label className="field"><span>New password</span><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} required /></label><button className="button" disabled={!token}>Reset password</button></form></section></main>;
}
