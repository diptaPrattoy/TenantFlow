import Link from "next/link";

export default function CheckoutCancelledPage() {
  return <main className="auth-shell"><section className="auth-card"><div className="auth-heading"><p className="kicker">Checkout cancelled</p><h1>No payment was completed.</h1><p className="muted">Your organization has not been activated. You can return to registration and try again.</p></div><Link className="button full" href="/register">Return to registration</Link><Link className="button secondary full" href="/">Back home</Link></section></main>;
}
