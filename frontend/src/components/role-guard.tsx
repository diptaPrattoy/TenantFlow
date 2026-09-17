"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { dashboardForRole, useAuth } from "./auth-provider";
import type { UserRole } from "@/lib/types";

export function RoleGuard({
  roles,
  children,
}: {
  roles: UserRole[];
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (!roles.includes(user.role)) {
      router.replace(dashboardForRole(user.role));
    }
  }, [loading, roles, router, user]);

  if (loading || !user || !roles.includes(user.role)) {
    return <div className="screen-center muted">Loading your workspace…</div>;
  }

  return <>{children}</>;
}
