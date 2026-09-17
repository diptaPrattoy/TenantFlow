"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { apiRequest } from "@/lib/api";
import { Notice } from "@/components/ui";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    try {
      const response = await apiRequest<{ message?: string }>("/auth/forgot-password", { method: "POST", body: JSON.stringify({ email }) });
      setMessage(response.message ?? "If the account exists, a reset email has been sent.");
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to request reset."); }
  };

  return <main className="auth-shell"><section className="auth-card"><Link href="/" className="sidebar-brand"><span className="brand-mark">TF</span><span>TenantFlow</span></Link><div className="auth-heading"><p className="kicker">Account recovery</p><h1>Reset your password</h1><p className="muted">We’ll email a time-limited reset link.</p></div>{message && <Notice tone="success">{message}</Notice>}{error && <Notice tone="error">{error}</Notice>}<form className="form-stack" onSubmit={submit}><label className="field"><span>Email</span><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></label><button className="button">Send reset link</button></form><div className="auth-links"><Link href="/login">Back to sign in</Link></div></section></main>;
}
