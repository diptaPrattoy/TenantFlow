"use client";

export function Notice({
  children,
  tone = "default",
}: {
  children: React.ReactNode;
  tone?: "default" | "error" | "success";
}) {
  return <div className={`notice ${tone}`}>{children}</div>;
}

export function LoadingBlock({ label = "Loading…" }: { label?: string }) {
  return <div className="panel muted">{label}</div>;
}

export function EmptyState({ children }: { children: React.ReactNode }) {
  return <div className="empty-state">{children}</div>;
}
