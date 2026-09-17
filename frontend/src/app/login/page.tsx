"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { dashboardForRole, useAuth } from "@/components/auth-provider";
import { Notice } from "@/components/ui";

export default function LoginPage() {
  const { user, loading, login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user) router.replace(dashboardForRole(user.role));
  }, [loading, router, user]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const loggedInUser = await login(email, password);
      router.replace(dashboardForRole(loggedInUser.role));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to sign in.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <Link href="/" className="sidebar-brand"><span className="brand-mark">TF</span><span>TenantFlow</span></Link>
        <div className="auth-heading">
          <p className="kicker">Welcome back</p>
          <h1>Sign in</h1>
          <p className="muted">Use your platform or organization account.</p>
        </div>
        {error && <Notice tone="error">{error}</Notice>}
        <form className="form-stack" onSubmit={submit}>
          <label className="field"><span>Email</span><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
          <label className="field"><span>Password</span><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} required /></label>
          <button className="button full" disabled={submitting}>{submitting ? "Signing in…" : "Sign in"}</button>
        </form>
        <div className="auth-links">
          <Link href="/forgot-password">Forgot password?</Link>
          <Link href="/register">Create an organization</Link>
        </div>
      </section>
    </main>
  );
}
