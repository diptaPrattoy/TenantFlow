"use client";

import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";
import type { ApiEnvelope, CurrentUser } from "@/lib/types";
import { Notice } from "./ui";
import { useAuth } from "./auth-provider";

export function ProfilePanel() {
  const queryClient = useQueryClient();
  const { refreshUser } = useAuth();
  const profile = useQuery({
    queryKey: ["profile"],
    queryFn: async () => (await apiRequest<ApiEnvelope<CurrentUser>>("/profile")).data,
  });
  const [name, setName] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const updateProfile = useMutation({
    mutationFn: (payload: { name: string }) => apiRequest("/profile", { method: "PATCH", body: JSON.stringify(payload) }),
    onSuccess: async () => {
      setMessage("Profile updated.");
      setError("");
      await queryClient.invalidateQueries({ queryKey: ["profile"] });
      await refreshUser();
    },
    onError: (err) => setError(err instanceof Error ? err.message : "Unable to update profile."),
  });

  const changePassword = useMutation({
    mutationFn: (payload: { currentPassword: string; newPassword: string }) => apiRequest("/profile/password", { method: "PATCH", body: JSON.stringify(payload) }),
    onSuccess: () => {
      setCurrentPassword("");
      setNewPassword("");
      setMessage("Password changed successfully.");
      setError("");
    },
    onError: (err) => setError(err instanceof Error ? err.message : "Unable to change password."),
  });

  const submitProfile = (event: FormEvent) => {
    event.preventDefault();
    const value = name.trim() || profile.data?.name || "";
    if (value) updateProfile.mutate({ name: value });
  };

  const submitPassword = (event: FormEvent) => {
    event.preventDefault();
    changePassword.mutate({ currentPassword, newPassword });
  };

  return (
    <div className="two-column">
      <section className="panel">
        <div className="panel-heading"><div><p className="kicker">Account</p><h2>Profile</h2></div></div>
        {message && <Notice tone="success">{message}</Notice>}
        {error && <Notice tone="error">{error}</Notice>}
        <form className="form-stack" onSubmit={submitProfile}>
          <label className="field"><span>Name</span><input value={name} placeholder={profile.data?.name ?? ""} onChange={(e) => setName(e.target.value)} minLength={2} /></label>
          <label className="field"><span>Email</span><input value={profile.data?.email ?? ""} disabled /></label>
          <button className="button" disabled={updateProfile.isPending}>Save profile</button>
        </form>
      </section>
      <section className="panel">
        <div className="panel-heading"><div><p className="kicker">Security</p><h2>Change password</h2></div></div>
        <form className="form-stack" onSubmit={submitPassword}>
          <label className="field"><span>Current password</span><input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} minLength={8} required /></label>
          <label className="field"><span>New password</span><input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} minLength={8} required /></label>
          <button className="button" disabled={changePassword.isPending}>Change password</button>
        </form>
      </section>
    </div>
  );
}
