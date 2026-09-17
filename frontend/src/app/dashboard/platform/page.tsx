"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/app-shell";
import { RoleGuard } from "@/components/role-guard";
import { EmptyState, Notice } from "@/components/ui";
import { apiRequest } from "@/lib/api";
import { formatDate, formatMoney, labelize } from "@/lib/format";
import type { ApiEnvelope, Plan } from "@/lib/types";

type Stats = { totalOrganizations: number; totalUsers: number; activeSubscriptions: number; totalRevenueAmount: number; revenueCurrency: string; failedPaymentCount: number; recentSignups: Array<{ id: string; name: string; createdAt: string; status: string }> };
type AdminOrganization = { id: string; name: string; status: string; createdAt: string; _count: { users: number }; subscription: { status: string; currentPeriodEnd: string | null; plan: { id: string; name: string } } | null };
type AdminPlan = Plan & { isActive: boolean; createdAt: string };
type AdminTransaction = { id: string; organizationId: string | null; type: string; status: string; amount: number; currency: string; description: string | null; createdAt: string; organization: { id: string; name: string } | null };
type Tab = "overview" | "organizations" | "plans" | "transactions";

export default function PlatformDashboard() {
  const [tab, setTab] = useState<Tab>("overview");
  return <RoleGuard roles={["PLATFORM_ADMIN"]}><AppShell title="Platform administration" subtitle="Platform admin" nav={[]}>
    <div className="tab-bar">{(["overview", "organizations", "plans", "transactions"] as Tab[]).map((item) => <button className={tab === item ? "tab active" : "tab"} key={item} onClick={() => setTab(item)}>{labelize(item)}</button>)}</div>
    {tab === "overview" && <Overview />}
    {tab === "organizations" && <Organizations />}
    {tab === "plans" && <Plans />}
    {tab === "transactions" && <Transactions />}
  </AppShell></RoleGuard>;
}

function Overview() {
  const stats = useQuery({ queryKey: ["admin-stats"], queryFn: async () => (await apiRequest<ApiEnvelope<Stats>>("/admin/stats")).data });
  const data = stats.data;
  return <><section className="stat-grid"><article className="stat-card"><span>Organizations</span><strong>{data?.totalOrganizations ?? "—"}</strong></article><article className="stat-card"><span>Total users</span><strong>{data?.totalUsers ?? "—"}</strong></article><article className="stat-card"><span>Active subscriptions</span><strong>{data?.activeSubscriptions ?? "—"}</strong></article><article className="stat-card"><span>Total revenue</span><strong>{data ? formatMoney(data.totalRevenueAmount, data.revenueCurrency) : "—"}</strong></article><article className="stat-card"><span>Failed payments</span><strong>{data?.failedPaymentCount ?? "—"}</strong></article></section><section className="panel"><div className="panel-heading"><div><p className="kicker">Latest</p><h2>Recent signups</h2></div></div>{data?.recentSignups?.length ? <div className="table-wrap"><table><thead><tr><th>Organization</th><th>Status</th><th>Signup date</th></tr></thead><tbody>{data.recentSignups.map((org) => <tr key={org.id}><td><Link className="text-link" href={`/dashboard/platform/organizations/${org.id}`}>{org.name}</Link></td><td><span className="badge">{labelize(org.status)}</span></td><td>{formatDate(org.createdAt)}</td></tr>)}</tbody></table></div> : <EmptyState>No recent signups.</EmptyState>}</section></>;
}

function Organizations() {
  const [search, setSearch] = useState(""); const [status, setStatus] = useState("");
  const organizations = useQuery({ queryKey: ["admin-organizations", search, status], queryFn: async () => { const params = new URLSearchParams(); if (search) params.set("search", search); if (status) params.set("status", status); const suffix = params.size ? `?${params.toString()}` : ""; return (await apiRequest<ApiEnvelope<AdminOrganization[]>>(`/admin/organizations${suffix}`)).data; } });
  return <section className="panel"><div className="panel-heading responsive"><div><p className="kicker">Tenants</p><h2>Organizations</h2></div><div className="filter-row"><input className="compact-input" placeholder="Search organizations" value={search} onChange={(e) => setSearch(e.target.value)} /><select className="compact-select" value={status} onChange={(e) => setStatus(e.target.value)}><option value="">All statuses</option><option value="ACTIVE">Active</option><option value="TRIAL">Trial</option><option value="SUSPENDED">Suspended</option><option value="CANCELLED">Cancelled</option></select></div></div>{organizations.data?.length ? <div className="table-wrap"><table><thead><tr><th>Organization</th><th>Plan</th><th>Status</th><th>Members</th><th>Signup</th><th></th></tr></thead><tbody>{organizations.data.map((org) => <tr key={org.id}><td><strong>{org.name}</strong></td><td>{org.subscription?.plan.name ?? "—"}</td><td><span className="badge">{labelize(org.status)}</span></td><td>{org._count.users}</td><td>{formatDate(org.createdAt)}</td><td><Link className="text-link" href={`/dashboard/platform/organizations/${org.id}`}>View</Link></td></tr>)}</tbody></table></div> : <EmptyState>No organizations found.</EmptyState>}</section>;
}

function Plans() {
  const qc = useQueryClient(); const plans = useQuery({ queryKey: ["admin-plans"], queryFn: async () => (await apiRequest<ApiEnvelope<AdminPlan[]>>("/admin/plans")).data });
  const [form, setForm] = useState({ name: "", description: "", price: "", currency: "USD", billingInterval: "MONTHLY", features: "members=10\nanalytics=true" }); const [message, setMessage] = useState(""); const [error, setError] = useState("");
  const parseFeatures = () => Object.fromEntries(form.features.split("\n").map((line) => line.trim()).filter(Boolean).map((line) => { const [key, ...parts] = line.split("="); const raw = parts.join("=").trim(); let value: string | number | boolean = raw; if (raw === "true" || raw === "false") value = raw === "true"; else if (raw && !Number.isNaN(Number(raw))) value = Number(raw); return [key.trim(), value]; }));
  const create = useMutation({ mutationFn: () => apiRequest("/admin/plans", { method: "POST", body: JSON.stringify({ name: form.name, description: form.description || null, priceAmount: Math.round(Number(form.price) * 100), currency: form.currency, billingInterval: form.billingInterval, features: parseFeatures() }) }), onSuccess: async () => { setMessage("Plan created."); setError(""); setForm({ ...form, name: "", description: "", price: "" }); await qc.invalidateQueries({ queryKey: ["admin-plans"] }); }, onError: (e) => setError(e instanceof Error ? e.message : "Unable to create plan.") });
  const toggle = useMutation({ mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => apiRequest(`/admin/plans/${id}`, { method: "PATCH", body: JSON.stringify({ isActive }) }), onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-plans"] }) });
  const edit = useMutation({ mutationFn: ({ id, payload }: { id: string; payload: Record<string, unknown> }) => apiRequest(`/admin/plans/${id}`, { method: "PATCH", body: JSON.stringify(payload) }), onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-plans"] }) });
  const editPlan = (plan: AdminPlan) => {
    const name = window.prompt("Plan name", plan.name);
    if (!name?.trim()) return;
    const price = window.prompt("Price", String(plan.priceAmount / 100));
    if (!price || Number.isNaN(Number(price)) || Number(price) <= 0) return;
    const interval = window.prompt("Billing interval: MONTHLY or YEARLY", plan.billingInterval)?.toUpperCase();
    if (interval !== "MONTHLY" && interval !== "YEARLY") return;
    const featureText = Object.entries(plan.features).map(([key, value]) => `${key}=${String(value)}`).join("\n");
    const featuresInput = window.prompt("Features (one key=value per line)", featureText);
    if (featuresInput === null) return;
    const features = Object.fromEntries(featuresInput.split("\n").map((line) => line.trim()).filter(Boolean).map((line) => { const [key, ...parts] = line.split("="); const raw = parts.join("=").trim(); let value: string | number | boolean = raw; if (raw === "true" || raw === "false") value = raw === "true"; else if (raw && !Number.isNaN(Number(raw))) value = Number(raw); return [key.trim(), value]; }));
    edit.mutate({ id: plan.id, payload: { name: name.trim(), priceAmount: Math.round(Number(price) * 100), billingInterval: interval, features } });
  };
  const submit = (e: FormEvent) => { e.preventDefault(); create.mutate(); };
  return <div className="two-column members-layout"><section className="panel"><div className="panel-heading"><div><p className="kicker">Create</p><h2>New plan</h2></div></div>{message && <Notice tone="success">{message}</Notice>}{error && <Notice tone="error">{error}</Notice>}<form className="form-stack" onSubmit={submit}><label className="field"><span>Name</span><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></label><label className="field"><span>Description</span><textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label><div className="inline-fields"><label className="field"><span>Price</span><input type="number" min="0.01" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} required /></label><label className="field"><span>Currency</span><input maxLength={3} value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value.toUpperCase() })} required /></label></div><label className="field"><span>Billing interval</span><select value={form.billingInterval} onChange={(e) => setForm({ ...form, billingInterval: e.target.value })}><option value="MONTHLY">Monthly</option><option value="YEARLY">Yearly</option></select></label><label className="field"><span>Features (one key=value per line)</span><textarea rows={4} value={form.features} onChange={(e) => setForm({ ...form, features: e.target.value })} /></label><button className="button">Create plan</button></form></section><section className="panel grow"><div className="panel-heading"><div><p className="kicker">Catalog</p><h2>Plans</h2></div></div><div className="stack-list">{plans.data?.map((plan) => <article className="list-card" key={plan.id}><div><strong>{plan.name}</strong><small>{formatMoney(plan.priceAmount, plan.currency)} / {plan.billingInterval.toLowerCase()}</small><small>{plan.description}</small></div><div className="list-actions"><span className={`badge ${plan.isActive ? "" : "muted-badge"}`}>{plan.isActive ? "Active" : "Disabled"}</span><button className="text-button" onClick={() => editPlan(plan)}>Edit</button><button className="text-button" onClick={() => toggle.mutate({ id: plan.id, isActive: !plan.isActive })}>{plan.isActive ? "Disable" : "Enable"}</button></div></article>)}</div></section></div>;
}

function Transactions() {
  const [status, setStatus] = useState(""); const [organizationId, setOrganizationId] = useState(""); const [from, setFrom] = useState(""); const [to, setTo] = useState("");
  const organizations = useQuery({ queryKey: ["admin-organizations-filter"], queryFn: async () => (await apiRequest<ApiEnvelope<AdminOrganization[]>>("/admin/organizations")).data });
  const transactions = useQuery({ queryKey: ["admin-transactions", organizationId, status, from, to], queryFn: async () => { const params = new URLSearchParams(); if (organizationId) params.set("organizationId", organizationId); if (status) params.set("status", status); if (from) params.set("from", from); if (to) params.set("to", to); return (await apiRequest<ApiEnvelope<AdminTransaction[]>>(`/admin/transactions${params.size ? `?${params}` : ""}`)).data; } });
  return <section className="panel"><div className="panel-heading responsive"><div><p className="kicker">Platform-wide</p><h2>Transactions</h2></div><div className="filter-row"><select className="compact-select" value={organizationId} onChange={(e) => setOrganizationId(e.target.value)}><option value="">All organizations</option>{organizations.data?.map((org) => <option key={org.id} value={org.id}>{org.name}</option>)}</select><select className="compact-select" value={status} onChange={(e) => setStatus(e.target.value)}><option value="">All statuses</option><option value="PENDING">Pending</option><option value="SUCCESS">Success</option><option value="FAILED">Failed</option><option value="REFUNDED">Refunded</option><option value="ROLLED_BACK">Rolled back</option></select><input className="compact-input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} /><input className="compact-input" type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div></div>{transactions.data?.length ? <div className="table-wrap"><table><thead><tr><th>Date</th><th>Organization</th><th>Type</th><th>Amount</th><th>Status</th></tr></thead><tbody>{transactions.data.map((item) => <tr key={item.id}><td>{formatDate(item.createdAt)}</td><td>{item.organization?.name ?? "Pending registration"}</td><td>{labelize(item.type)}</td><td>{formatMoney(item.amount, item.currency)}</td><td><span className="badge">{labelize(item.status)}</span></td></tr>)}</tbody></table></div> : <EmptyState>No transactions found.</EmptyState>}</section>;
}
