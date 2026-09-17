"use client";

import { FormEvent, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/app-shell";
import { ProfilePanel } from "@/components/profile-panel";
import { RoleGuard } from "@/components/role-guard";
import { EmptyState, LoadingBlock, Notice } from "@/components/ui";
import { useAuth } from "@/components/auth-provider";
import { apiRequest } from "@/lib/api";
import { formatDate, formatMoney, labelize } from "@/lib/format";
import type { ApiEnvelope, Plan } from "@/lib/types";

type Organization = { id: string; name: string; contactEmail: string | null; contactPhone: string | null; billingEmail: string; status: string; createdAt: string; subscription: { status: string; currentPeriodEnd: string | null; plan: { id: string; name: string; billingInterval: string } } | null };
type Member = { id: string; name: string; email: string; role: "ORG_ADMIN" | "ORG_MEMBER"; status: string; lastLoginAt: string | null; createdAt: string };
type Subscription = { id: string; status: string; currentPeriodStart: string | null; currentPeriodEnd: string | null; cancelAtPeriodEnd: boolean; plan: Plan; events: Array<{ id: string; eventType: string; effectiveAt: string; createdAt: string; previousPlan: { name: string } | null; newPlan: { name: string } | null }> };
type Payment = { id: string; amount: number; currency: string; status: string; paidAt: string | null; createdAt: string; invoiceUrl: string | null; invoicePdfUrl: string | null };
type Transaction = { id: string; type: string; status: string; amount: number; currency: string; description: string | null; createdAt: string };

type Tab = "overview" | "members" | "billing" | "transactions" | "profile";

export default function OrganizationDashboard() {
  const [tab, setTab] = useState<Tab>("overview");
  const nav = ["overview", "members", "billing", "transactions", "profile"] as Tab[];

  return <RoleGuard roles={["ORG_ADMIN"]}><AppShell title="Organization workspace" subtitle="Organization admin" nav={[]}>
    <div className="tab-bar">{nav.map((item) => <button key={item} className={tab === item ? "tab active" : "tab"} onClick={() => setTab(item)}>{labelize(item)}</button>)}</div>
    {tab === "overview" && <OrganizationOverview />}
    {tab === "members" && <MembersPanel />}
    {tab === "billing" && <BillingPanel />}
    {tab === "transactions" && <TransactionsPanel />}
    {tab === "profile" && <ProfilePanel />}
  </AppShell></RoleGuard>;
}

function OrganizationOverview() {
  const queryClient = useQueryClient();
  const organization = useQuery({ queryKey: ["organization"], queryFn: async () => (await apiRequest<ApiEnvelope<Organization>>("/organization")).data });
  const [form, setForm] = useState({ name: "", contactEmail: "", contactPhone: "", billingEmail: "" });
  const [message, setMessage] = useState("");
  const update = useMutation({ mutationFn: (body: Record<string, string | null>) => apiRequest("/organization", { method: "PATCH", body: JSON.stringify(body) }), onSuccess: async () => { setMessage("Organization updated."); await queryClient.invalidateQueries({ queryKey: ["organization"] }); }, });
  const submit = (event: FormEvent) => { event.preventDefault(); const current = organization.data; if (!current) return; update.mutate({ name: form.name || current.name, contactEmail: form.contactEmail || current.contactEmail, contactPhone: form.contactPhone || current.contactPhone, billingEmail: form.billingEmail || current.billingEmail }); };
  if (organization.isLoading) return <LoadingBlock />;
  const org = organization.data;
  if (!org) return <Notice tone="error">Unable to load organization.</Notice>;
  return <><section className="stat-grid"><article className="stat-card"><span>Organization</span><strong>{org.name}</strong></article><article className="stat-card"><span>Plan</span><strong>{org.subscription?.plan.name ?? "—"}</strong></article><article className="stat-card"><span>Subscription</span><strong>{org.subscription?.status ?? "—"}</strong></article><article className="stat-card"><span>Renewal</span><strong>{formatDate(org.subscription?.currentPeriodEnd)}</strong></article></section><section className="panel"><div className="panel-heading"><div><p className="kicker">Organization profile</p><h2>Contact and billing details</h2></div></div>{message && <Notice tone="success">{message}</Notice>}<form className="form-grid" onSubmit={submit}><label className="field"><span>Name</span><input placeholder={org.name} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label><label className="field"><span>Contact email</span><input type="email" placeholder={org.contactEmail ?? "Not set"} value={form.contactEmail} onChange={(e) => setForm({ ...form, contactEmail: e.target.value })} /></label><label className="field"><span>Contact phone</span><input placeholder={org.contactPhone ?? "Not set"} value={form.contactPhone} onChange={(e) => setForm({ ...form, contactPhone: e.target.value })} /></label><label className="field"><span>Billing email</span><input type="email" placeholder={org.billingEmail} value={form.billingEmail} onChange={(e) => setForm({ ...form, billingEmail: e.target.value })} /></label><button className="button span-2" disabled={update.isPending}>Save organization</button></form></section></>;
}

function MembersPanel() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"ORG_ADMIN" | "ORG_MEMBER">("ORG_MEMBER");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const members = useQuery({
    queryKey: ["organization-members"],
    queryFn: async () =>
      (await apiRequest<ApiEnvelope<Member[]>>("/organization/members")).data,
  });

  const refreshMembers = () =>
    queryClient.invalidateQueries({ queryKey: ["organization-members"] });

  const invite = useMutation({
    mutationFn: () =>
      apiRequest("/organization/invitations", {
        method: "POST",
        body: JSON.stringify({ email, role }),
      }),
    onSuccess: async () => {
      setMessage("Invitation sent.");
      setEmail("");
      setError("");
      await refreshMembers();
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : "Unable to invite member.");
    },
  });

  const changeRole = useMutation({
    mutationFn: ({
      id,
      nextRole,
    }: {
      id: string;
      nextRole: "ORG_ADMIN" | "ORG_MEMBER";
    }) =>
      apiRequest(`/organization/members/${id}/role`, {
        method: "PATCH",
        body: JSON.stringify({ role: nextRole }),
      }),
    onSuccess: async () => {
      setError("");
      await refreshMembers();
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : "Unable to change member role.");
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) =>
      apiRequest(`/organization/members/${id}`, { method: "DELETE" }),
    onSuccess: async () => {
      setMessage("Member removed.");
      setError("");
      await refreshMembers();
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : "Unable to remove member.");
    },
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    invite.mutate();
  };

  const removeMember = (member: Member) => {
    if (member.id === user?.id) {
      setError("You cannot remove your own account from the organization.");
      return;
    }

    if (window.confirm(`Remove ${member.name} from the organization?`)) {
      remove.mutate(member.id);
    }
  };

  return (
    <div className="two-column members-layout">
      <section className="panel">
        <div className="panel-heading">
          <div>
            <p className="kicker">Invite</p>
            <h2>Add a member</h2>
          </div>
        </div>

        {message && <Notice tone="success">{message}</Notice>}
        {error && <Notice tone="error">{error}</Notice>}

        <form className="form-stack" onSubmit={submit}>
          <label className="field">
            <span>Email</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>
          <label className="field">
            <span>Role</span>
            <select
              value={role}
              onChange={(event) =>
                setRole(event.target.value as "ORG_ADMIN" | "ORG_MEMBER")
              }
            >
              <option value="ORG_MEMBER">Member</option>
              <option value="ORG_ADMIN">Organization admin</option>
            </select>
          </label>
          <button className="button" disabled={invite.isPending}>
            {invite.isPending ? "Sending…" : "Send invitation"}
          </button>
        </form>
      </section>

      <section className="panel grow">
        <div className="panel-heading">
          <div>
            <p className="kicker">Team</p>
            <h2>Members</h2>
          </div>
          <span className="muted">{members.data?.length ?? 0} accounts</span>
        </div>

        {members.isLoading ? (
          <LoadingBlock />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Member</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Joined</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {members.data?.map((member) => {
                  const isCurrentUser = member.id === user?.id;

                  return (
                    <tr key={member.id}>
                      <td>
                        <strong>
                          {member.name}
                          {isCurrentUser && <span className="you-badge">You</span>}
                        </strong>
                        <small>{member.email}</small>
                      </td>
                      <td>
                        <select
                          value={member.role}
                          disabled={isCurrentUser || changeRole.isPending}
                          title={
                            isCurrentUser
                              ? "You cannot change your own organization role."
                              : undefined
                          }
                          onChange={(event) =>
                            changeRole.mutate({
                              id: member.id,
                              nextRole: event.target.value as
                                | "ORG_ADMIN"
                                | "ORG_MEMBER",
                            })
                          }
                        >
                          <option value="ORG_MEMBER">Member</option>
                          <option value="ORG_ADMIN">Org admin</option>
                        </select>
                      </td>
                      <td>
                        <span className="badge">{labelize(member.status)}</span>
                      </td>
                      <td>{formatDate(member.createdAt)}</td>
                      <td>
                        {isCurrentUser ? (
                          <span className="current-account-label">Current account</span>
                        ) : (
                          <button
                            className="text-button danger"
                            onClick={() => removeMember(member)}
                            disabled={remove.isPending}
                            type="button"
                          >
                            Remove
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function BillingPanel() {
  const qc = useQueryClient();
  const subscription = useQuery({ queryKey: ["billing-subscription"], queryFn: async () => (await apiRequest<ApiEnvelope<Subscription>>("/billing/subscription")).data });
  const payments = useQuery({ queryKey: ["billing-payments"], queryFn: async () => (await apiRequest<ApiEnvelope<Payment[]>>("/billing/payments")).data });
  const plans = useQuery({ queryKey: ["public-plans"], queryFn: async () => (await apiRequest<ApiEnvelope<Plan[]>>("/plans")).data });
  const [message, setMessage] = useState("");
  const change = useMutation({ mutationFn: (planId: string) => apiRequest("/billing/subscription/plan", { method: "PATCH", body: JSON.stringify({ planId }) }), onSuccess: async () => { setMessage("Subscription updated."); await qc.invalidateQueries({ queryKey: ["billing-subscription"] }); } });
  const cancel = useMutation({ mutationFn: () => apiRequest("/billing/subscription/cancel", { method: "POST" }), onSuccess: async () => { setMessage("Cancellation scheduled for the end of the billing period."); await qc.invalidateQueries({ queryKey: ["billing-subscription"] }); } });
  const portal = useMutation({ mutationFn: async () => (await apiRequest<ApiEnvelope<{ url: string }>>("/billing/portal", { method: "POST" })).data, onSuccess: (data) => window.location.assign(data.url) });
  const active = subscription.data;
  const alternatives = useMemo(() => plans.data?.filter((plan) => plan.id !== active?.plan.id) ?? [], [active?.plan.id, plans.data]);
  return <><section className="stat-grid"><article className="stat-card"><span>Current plan</span><strong>{active?.plan.name ?? "—"}</strong><small>{active ? formatMoney(active.plan.priceAmount, active.plan.currency) : ""}</small></article><article className="stat-card"><span>Status</span><strong>{active?.status ?? "—"}</strong></article><article className="stat-card"><span>Renews</span><strong>{formatDate(active?.currentPeriodEnd)}</strong></article><article className="stat-card"><span>Cancellation</span><strong>{active?.cancelAtPeriodEnd ? "Scheduled" : "Not scheduled"}</strong></article></section>{message && <Notice tone="success">{message}</Notice>}<div className="two-column"><section className="panel"><div className="panel-heading"><div><p className="kicker">Subscription</p><h2>Manage plan</h2></div></div><div className="form-stack">{alternatives.map((plan) => <button key={plan.id} className="plan-option" onClick={() => change.mutate(plan.id)}><span><strong>{plan.name}</strong><small>{formatMoney(plan.priceAmount, plan.currency)} / {plan.billingInterval.toLowerCase()}</small></span><span>Switch</span></button>)}<button className="button secondary" onClick={() => portal.mutate()}>Manage payment method</button><button className="text-button danger align-left" onClick={() => cancel.mutate()}>Cancel at period end</button></div></section><section className="panel"><div className="panel-heading"><div><p className="kicker">History</p><h2>Subscription events</h2></div></div><div className="timeline">{active?.events.map((event) => <div className="timeline-item" key={event.id}><span className="timeline-dot"/><div><strong>{labelize(event.eventType)}</strong><small>{event.previousPlan?.name && event.newPlan?.name ? `${event.previousPlan.name} → ${event.newPlan.name}` : event.newPlan?.name ?? ""}</small><small>{formatDate(event.createdAt)}</small></div></div>)}</div></section></div><section className="panel"><div className="panel-heading"><div><p className="kicker">Billing</p><h2>Payment history</h2></div></div>{payments.data?.length ? <div className="table-wrap"><table><thead><tr><th>Date</th><th>Amount</th><th>Status</th><th>Invoice</th></tr></thead><tbody>{payments.data.map((payment) => <tr key={payment.id}><td>{formatDate(payment.paidAt ?? payment.createdAt)}</td><td>{formatMoney(payment.amount, payment.currency)}</td><td><span className="badge">{labelize(payment.status)}</span></td><td>{payment.invoicePdfUrl || payment.invoiceUrl ? <a className="text-link" target="_blank" rel="noreferrer" href={payment.invoicePdfUrl ?? payment.invoiceUrl ?? "#"}>Download</a> : "—"}</td></tr>)}</tbody></table></div> : <EmptyState>No payments yet.</EmptyState>}</section></>;
}

function TransactionsPanel() {
  const [status, setStatus] = useState("");
  const transactions = useQuery({ queryKey: ["billing-transactions", status], queryFn: async () => (await apiRequest<ApiEnvelope<Transaction[]>>(`/billing/transactions${status ? `?status=${status}` : ""}`)).data });
  return <section className="panel"><div className="panel-heading"><div><p className="kicker">Financial activity</p><h2>Transactions</h2></div><select className="compact-select" value={status} onChange={(e) => setStatus(e.target.value)}><option value="">All statuses</option><option value="PENDING">Pending</option><option value="SUCCESS">Success</option><option value="FAILED">Failed</option><option value="REFUNDED">Refunded</option><option value="ROLLED_BACK">Rolled back</option></select></div>{transactions.data?.length ? <div className="table-wrap"><table><thead><tr><th>Date</th><th>Type</th><th>Amount</th><th>Status</th><th>Description</th></tr></thead><tbody>{transactions.data.map((item) => <tr key={item.id}><td>{formatDate(item.createdAt)}</td><td>{labelize(item.type)}</td><td>{formatMoney(item.amount, item.currency)}</td><td><span className="badge">{labelize(item.status)}</span></td><td>{item.description ?? "—"}</td></tr>)}</tbody></table></div> : <EmptyState>No transactions found.</EmptyState>}</section>;
}
