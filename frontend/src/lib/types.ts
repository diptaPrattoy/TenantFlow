export type UserRole = "PLATFORM_ADMIN" | "ORG_ADMIN" | "ORG_MEMBER";
export type UserStatus = "ACTIVE" | "SUSPENDED" | "REMOVED";

export type CurrentUser = {
  id: string;
  organizationId: string | null;
  name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  lastLoginAt: string | null;
  createdAt: string;
};

export type Plan = {
  id: string;
  name: string;
  description: string | null;
  priceAmount: number;
  currency: string;
  billingInterval: "MONTHLY" | "YEARLY";
  features: Record<string, string | number | boolean>;
  isActive?: boolean;
};

export type ApiEnvelope<T> = {
  success: boolean;
  message?: string;
  data: T;
};
