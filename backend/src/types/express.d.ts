import type { OrganizationStatus, UserRole, UserStatus } from "../generated/prisma/enums.js";

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        organizationId: string | null;
        name: string;
        email: string;
        role: UserRole;
        status: UserStatus;
        organizationStatus: OrganizationStatus | null;
      };
      tenant?: {
        organizationId: string;
      };
    }
  }
}

export {};
