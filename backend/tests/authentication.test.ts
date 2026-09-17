import { beforeEach, describe, expect, it, vi } from "vitest";

const { findUnique, verifyAccessToken } = vi.hoisted(() => ({
  findUnique: vi.fn(),
  verifyAccessToken: vi.fn(),
}));

vi.mock("../src/lib/prisma.js", () => ({
  prisma: {
    user: { findUnique },
  },
}));

vi.mock("../src/utils/token.js", () => ({
  verifyAccessToken,
}));

import { authenticate } from "../src/middleware/auth.middleware.js";

describe("authentication middleware", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects requests without a bearer token", async () => {
    const req = { headers: {} } as any;
    const next = vi.fn();

    await authenticate(req, {} as any, next);

    const error = next.mock.calls[0]?.[0];
    expect(error?.statusCode).toBe(401);
  });

  it("loads the current user from the database after verifying the token", async () => {
    verifyAccessToken.mockReturnValue({ sub: "user-1" });
    findUnique.mockResolvedValue({
      id: "user-1",
      organizationId: "org-1",
      name: "Test User",
      email: "user@example.com",
      role: "ORG_ADMIN",
      status: "ACTIVE",
      organization: { status: "ACTIVE" },
    });

    const req = {
      headers: { authorization: "Bearer valid-token" },
    } as any;
    const next = vi.fn();

    await authenticate(req, {} as any, next);

    expect(findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "user-1" } }),
    );
    expect(req.user).toMatchObject({
      id: "user-1",
      organizationId: "org-1",
      role: "ORG_ADMIN",
    });
    expect(next).toHaveBeenCalledWith();
  });

  it("invalidates a removed user even when the JWT itself is still valid", async () => {
    verifyAccessToken.mockReturnValue({ sub: "user-1" });
    findUnique.mockResolvedValue({
      id: "user-1",
      organizationId: "org-1",
      name: "Removed User",
      email: "removed@example.com",
      role: "ORG_MEMBER",
      status: "REMOVED",
      organization: { status: "ACTIVE" },
    });

    const req = {
      headers: { authorization: "Bearer valid-token" },
    } as any;
    const next = vi.fn();

    await authenticate(req, {} as any, next);

    const error = next.mock.calls[0]?.[0];
    expect(error?.statusCode).toBe(401);
  });
});
