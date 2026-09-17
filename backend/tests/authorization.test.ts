import { describe, expect, it, vi } from "vitest";

import { allowRoles } from "../src/middleware/role.middleware.js";
import { requireOrganizationContext } from "../src/middleware/tenant.middleware.js";
import { changeOrganizationMemberRole } from "../src/services/organization.service.js";

const { userFindFirst, userUpdate } = vi.hoisted(() => ({
  userFindFirst: vi.fn(),
  userUpdate: vi.fn(),
}));

vi.mock("../src/lib/prisma.js", () => ({
  prisma: {
    user: {
      findFirst: userFindFirst,
      update: userUpdate,
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    organization: { findUnique: vi.fn(), update: vi.fn() },
    subscription: { findUnique: vi.fn() },
    invitation: { findFirst: vi.fn(), update: vi.fn(), create: vi.fn() },
  },
}));

vi.mock("../src/services/email.service.js", () => ({
  sendInvitationEmail: vi.fn(),
}));

vi.mock("../src/config/env.js", () => ({
  env: {
    nodeEnv: "test",
    frontendUrl: "http://localhost:3000",
  },
}));

describe("role authorization", () => {
  it("allows an organization admin through an admin-only guard", () => {
    const middleware = allowRoles("ORG_ADMIN");
    const req = { user: { role: "ORG_ADMIN" } } as any;
    const next = vi.fn();

    middleware(req, {} as any, next);

    expect(next).toHaveBeenCalledWith();
  });

  it("rejects an organization member from an admin-only guard", () => {
    const middleware = allowRoles("ORG_ADMIN");
    const req = { user: { role: "ORG_MEMBER" } } as any;
    const next = vi.fn();

    middleware(req, {} as any, next);

    const error = next.mock.calls[0]?.[0];
    expect(error?.statusCode).toBe(403);
  });
});

describe("tenant isolation", () => {
  it("derives tenant context from the authenticated user", () => {
    const req = {
      user: { organizationId: "org-a" },
    } as any;
    const next = vi.fn();

    requireOrganizationContext(req, {} as any, next);

    expect(req.tenant).toEqual({ organizationId: "org-a" });
    expect(next).toHaveBeenCalledWith();
  });

  it("rejects accounts without an organization context", () => {
    const req = {
      user: { organizationId: null },
    } as any;
    const next = vi.fn();

    requireOrganizationContext(req, {} as any, next);

    const error = next.mock.calls[0]?.[0];
    expect(error?.statusCode).toBe(403);
  });

  it("scopes member changes to both member id and organization id", async () => {
    userFindFirst.mockResolvedValueOnce({ id: "member-b", status: "ACTIVE" });
    userUpdate.mockResolvedValueOnce({
      id: "member-b",
      role: "ORG_ADMIN",
      status: "ACTIVE",
    });

    await changeOrganizationMemberRole(
      "org-a",
      "admin-a",
      "member-b",
      { role: "ORG_ADMIN" },
    );

    expect(userFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: "member-b",
          organizationId: "org-a",
        },
      }),
    );
  });
});
