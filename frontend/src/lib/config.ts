export const appConfig = {
  name: "TenantFlow",
  apiBaseUrl:
    process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000/api/v1",
} as const;
