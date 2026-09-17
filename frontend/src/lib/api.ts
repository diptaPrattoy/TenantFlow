import { appConfig } from "./config";

const tokenKey = "tenantflow_access_token";

export class ApiRequestError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
  }
}

export const getAccessToken = () =>
  typeof window === "undefined" ? null : window.localStorage.getItem(tokenKey);

export const setAccessToken = (token: string) => {
  window.localStorage.setItem(tokenKey, token);
};

export const clearAccessToken = () => {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(tokenKey);
  }
};

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = getAccessToken();
  const headers = new Headers(options.headers);

  if (!headers.has("Content-Type") && options.body) {
    headers.set("Content-Type", "application/json");
  }

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${appConfig.apiBaseUrl}${path}`, {
    ...options,
    headers,
  });

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const message =
      typeof payload === "object" && payload !== null && "message" in payload
        ? String((payload as { message?: unknown }).message ?? "Request failed.")
        : "Request failed.";

    if (response.status === 401 && path !== "/auth/login") {
      clearAccessToken();
      if (typeof window !== "undefined" && window.location.pathname !== "/login") {
        window.location.assign("/login");
      }
    }

    throw new ApiRequestError(message, response.status);
  }

  return payload as T;
}
