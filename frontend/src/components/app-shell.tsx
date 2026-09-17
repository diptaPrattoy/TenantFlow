"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "./auth-provider";

type NavItem = { href: string; label: string };

const roleLabel = (role?: string) => {
  if (role === "PLATFORM_ADMIN") return "Platform admin";
  if (role === "ORG_ADMIN") return "Organization admin";
  if (role === "ORG_MEMBER") return "Organization member";
  return "Account";
};

const initials = (name?: string) =>
  name
    ?.split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "TF";

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
          <span className="brand-copy">
            <strong>TenantFlow</strong>
            <small>SaaS operations</small>
          </span>
        </Link>

        {nav.length > 0 && (
          <nav className="sidebar-nav">
            <p className="sidebar-label">Workspace</p>
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
        )}

        <div className="sidebar-user">
          <div className="user-avatar">{initials(user?.name)}</div>
          <div className="sidebar-user-copy">
            <strong>{user?.name}</strong>
            <span>{user?.email}</span>
            <small>{roleLabel(user?.role)}</small>
          </div>
          <button className="text-button sidebar-signout" onClick={logout} type="button">
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
          <div className="dashboard-account-chip">
            <span className="user-avatar small">{initials(user?.name)}</span>
            <div>
              <strong>{user?.name}</strong>
              <small>{roleLabel(user?.role)}</small>
            </div>
          </div>
        </header>
        {children}
      </main>
    </div>
  );
}
