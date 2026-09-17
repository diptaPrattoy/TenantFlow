"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "./auth-provider";

type NavItem = { href: string; label: string };

export function AppShell({
  title,
  subtitle,
  nav,
  children,
}: {
  title: string;
  subtitle: string;
  nav: NavItem[];
  children: React.ReactNode;
}) {
  const { user, logout } = useAuth();
  const pathname = usePathname();

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <Link href="/" className="sidebar-brand">
          <span className="brand-mark">TF</span>
          <span>TenantFlow</span>
        </Link>
        <nav className="sidebar-nav">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`nav-link ${pathname === item.href ? "active" : ""}`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="sidebar-user">
          <strong>{user?.name}</strong>
          <span>{user?.email}</span>
          <button className="text-button" onClick={logout} type="button">
            Sign out
          </button>
        </div>
      </aside>

      <main className="dashboard-main">
        <header className="dashboard-header">
          <div>
            <p className="kicker">{subtitle}</p>
            <h1 className="dashboard-title">{title}</h1>
          </div>
        </header>
        {children}
      </main>
    </div>
  );
}
