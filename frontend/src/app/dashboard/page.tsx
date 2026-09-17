"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { dashboardForRole, useAuth } from "@/components/auth-provider";

export default function DashboardRedirect() {
  const { user, loading } = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (!loading) router.replace(user ? dashboardForRole(user.role) : "/login");
  }, [loading, router, user]);
  return <div className="screen-center muted">Opening your dashboard…</div>;
}
