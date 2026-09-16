import { appConfig } from "@/lib/config";

const foundationItems = [
  {
    label: "Frontend",
    value: "Next.js + TypeScript",
  },
  {
    label: "Backend",
    value: "Express.js REST API",
  },
  {
    label: "API Base",
    value: appConfig.apiBaseUrl,
  },
];

export default function Home() {
  return (
    <main className="page-shell">
      <section className="hero-card">
        <div className="brand-row">
          <span className="brand-mark">TF</span>
          <span className="eyebrow">TenantFlow</span>
        </div>

        <div className="hero-copy">
          <p className="kicker">Multi-tenant SaaS platform</p>
          <h1>Project foundation is ready.</h1>
          <p className="description">
            TenantFlow is being built with a separated Next.js frontend and
            Express API. Database, authentication, billing, and tenant-specific
            business logic will be added incrementally.
          </p>
        </div>

        <div className="foundation-grid">
          {foundationItems.map((item) => (
            <article className="foundation-item" key={item.label}>
              <span>{item.label}</span>
              <strong>{item.value}</strong>
            </article>
          ))}
        </div>

        <div className="status-row">
          <span className="status-dot" aria-hidden="true" />
          <span>Commit 01 · Initial project setup</span>
        </div>
      </section>
    </main>
  );
}
