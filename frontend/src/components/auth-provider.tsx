"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest, clearAccessToken, getAccessToken, setAccessToken } from "@/lib/api";
import type { ApiEnvelope, CurrentUser } from "@/lib/types";

type AuthContextValue = {
  user: CurrentUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<CurrentUser>;
  logout: () => void;
  refreshUser: () => Promise<CurrentUser | null>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export const dashboardForRole = (role: CurrentUser["role"]) => {
  if (role === "PLATFORM_ADMIN") return "/dashboard/platform";
  if (role === "ORG_ADMIN") return "/dashboard/organization";
  return "/dashboard/member";
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    if (!getAccessToken()) {
      setUser(null);
      setLoading(false);
      return null;
    }

    try {
      const response = await apiRequest<ApiEnvelope<CurrentUser>>("/auth/me");
      setUser(response.data);
      return response.data;
    } catch {
      clearAccessToken();
      setUser(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshUser();
  }, [refreshUser]);

  const login = async (email: string, password: string) => {
    const response = await apiRequest<
      ApiEnvelope<{ accessToken: string; user: CurrentUser }>
    >("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });

    setAccessToken(response.data.accessToken);
    setUser(response.data.user);
    return response.data.user;
  };

  const logout = () => {
    clearAccessToken();
    setUser(null);
    router.push("/login");
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
};
