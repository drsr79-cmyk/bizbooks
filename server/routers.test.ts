import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import { COOKIE_NAME } from "../shared/const";
import type { TrpcContext } from "./_core/context";

type CookieCall = { name: string; options: Record<string, unknown> };
type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(overrides?: Partial<AuthenticatedUser>): { ctx: TrpcContext; clearedCookies: CookieCall[] } {
  const clearedCookies: CookieCall[] = [];
  const user: AuthenticatedUser = {
    id: 1,
    openId: "sample-user",
    email: "sample@example.com",
    name: "Sample User",
    loginMethod: "manus",
    role: "admin",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
    ...overrides,
  };
  const ctx: TrpcContext = {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {
      clearCookie: (name: string, options: Record<string, unknown>) => {
        clearedCookies.push({ name, options });
      },
    } as TrpcContext["res"],
  };
  return { ctx, clearedCookies };
}

function createUnauthContext(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

describe("auth.logout", () => {
  it("clears the session cookie and reports success", async () => {
    const { ctx, clearedCookies } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.logout();
    expect(result).toEqual({ success: true });
    expect(clearedCookies).toHaveLength(1);
    expect(clearedCookies[0]?.name).toBe(COOKIE_NAME);
    expect(clearedCookies[0]?.options).toMatchObject({ maxAge: -1 });
  });
});

describe("auth.me", () => {
  it("returns null for unauthenticated users", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.me();
    expect(result).toBeNull();
  });

  it("returns user for authenticated users", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.me();
    expect(result).toBeDefined();
    expect(result?.email).toBe("sample@example.com");
    expect(result?.name).toBe("Sample User");
  });
});

describe("router structure", () => {
  it("has all required routers", () => {
    const routerKeys = Object.keys(appRouter._def.procedures);
    const expectedPrefixes = ["auth", "onboarding", "company", "document", "transaction", "incomeStatement", "financial", "advisor", "staff"];
    for (const prefix of expectedPrefixes) {
      const hasPrefix = routerKeys.some(key => key.startsWith(prefix + "."));
      expect(hasPrefix, `Router should have '${prefix}' namespace`).toBe(true);
    }
  });

  it("has company member management procedures", () => {
    const routerKeys = Object.keys(appRouter._def.procedures);
    expect(routerKeys).toContain("company.getMembers");
    expect(routerKeys).toContain("company.addMember");
    expect(routerKeys).toContain("company.updateMember");
    expect(routerKeys).toContain("company.removeMember");
  });

  it("has transaction delete procedure", () => {
    const routerKeys = Object.keys(appRouter._def.procedures);
    expect(routerKeys).toContain("transaction.delete");
  });

  it("has document upload and OCR procedures", () => {
    const routerKeys = Object.keys(appRouter._def.procedures);
    expect(routerKeys).toContain("document.upload");
    expect(routerKeys).toContain("document.processWithOCR");
    expect(routerKeys).toContain("document.respondToClarification");
  });

  it("has financial statement procedures", () => {
    const routerKeys = Object.keys(appRouter._def.procedures);
    expect(routerKeys).toContain("financial.generateStatement");
    expect(routerKeys).toContain("financial.getSnapshots");
  });

  it("has advisor procedures", () => {
    const routerKeys = Object.keys(appRouter._def.procedures);
    expect(routerKeys).toContain("advisor.listConversations");
    expect(routerKeys).toContain("advisor.startConversation");
    expect(routerKeys).toContain("advisor.sendMessage");
  });

  it("has staff summary procedure", () => {
    const routerKeys = Object.keys(appRouter._def.procedures);
    expect(routerKeys).toContain("staff.summary");
  });

  it("has income statement CRUD procedures", () => {
    const routerKeys = Object.keys(appRouter._def.procedures);
    expect(routerKeys).toContain("incomeStatement.list");
    expect(routerKeys).toContain("incomeStatement.addLine");
    expect(routerKeys).toContain("incomeStatement.deleteLine");
  });
});

describe("onboarding", () => {
  it("updateProfile requires authentication", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.onboarding.updateProfile({ name: "Test", icNumber: "123456" })
    ).rejects.toThrow();
  });

  it("completeOnboarding requires authentication", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.onboarding.completeOnboarding()).rejects.toThrow();
  });
});

describe("company", () => {
  it("list requires authentication", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.company.list()).rejects.toThrow();
  });

  it("create validates input", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.company.create({
        name: "",
        companyType: "sdn_bhd",
        ssmNumber: "123",
      })
    ).rejects.toThrow();
  });

  it("addMember requires authentication", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.company.addMember({
        companyId: 1,
        userEmail: "test@test.com",
        memberRole: "staff",
        accessLevel: "full",
      })
    ).rejects.toThrow();
  });

  it("updateMember requires authentication", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.company.updateMember({
        memberId: 1,
        companyId: 1,
        memberRole: "staff",
      })
    ).rejects.toThrow();
  });

  it("removeMember requires authentication", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.company.removeMember({ memberId: 1, companyId: 1 })
    ).rejects.toThrow();
  });
});

describe("transaction", () => {
  it("delete requires authentication", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.transaction.delete({ transactionId: 1, companyId: 1 })
    ).rejects.toThrow();
  });

  it("create validates required fields", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.transaction.create({
        companyId: 1,
        date: "2024-01-01",
        description: "",
        amount: "100",
        transactionType: "debit",
      })
    ).rejects.toThrow();
  });
});

describe("document", () => {
  it("upload requires authentication", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.document.upload({
        companyId: 1,
        docType: "receipt",
        fileName: "test.jpg",
        fileBase64: "abc",
        mimeType: "image/jpeg",
      })
    ).rejects.toThrow();
  });
});

describe("advisor", () => {
  it("startConversation requires authentication", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.advisor.startConversation({
        companyId: 1,
        advisorType: "cfo",
      })
    ).rejects.toThrow();
  });

  it("sendMessage requires authentication", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.advisor.sendMessage({
        conversationId: 1,
        message: "Hello",
      })
    ).rejects.toThrow();
  });
});
