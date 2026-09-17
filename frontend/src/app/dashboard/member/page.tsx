"use client";

import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/app-shell";
import { ProfilePanel } from "@/components/profile-panel";
import { RoleGuard } from "@/components/role-guard";
import { LoadingBlock } from "@/components/ui";
import { apiRequest } from "@/lib/api";
import type { ApiEnvelope } from "@/lib/types";

type MemberOrganization = { id: string; name: string; status: string; plan: { name: string } | null };

export default function MemberDashboard() {
  return <RoleGuard roles={["ORG_MEMBER"]}><MemberWorkspace /></RoleGuard>;
}

function MemberWorkspace() {
  const organization = useQuery({ queryKey: ["organization", "member"], queryFn: async () => (await apiRequest<ApiEnvelope<MemberOrganization>>("/organization")).data });

  return <AppShell title="Member workspace" subtitle="Organization member" nav={[{ href: "/dashboard/member", label: "Workspace" }]}>
    <section className="stat-grid compact">
      <article className="stat-card"><span>Organization</span><strong>{organization.data?.name ?? "—"}</strong></article>
      <article className="stat-card"><span>Plan</span><strong>{organization.data?.plan?.name ?? "—"}</strong></article>
      <article className="stat-card"><span>Status</span><strong>{organization.data?.status ?? "—"}</strong></article>
    </section>
    {organization.isLoading && <LoadingBlock label="Loading organization…" />}
    <ProfilePanel />
  </AppShell>;
}
