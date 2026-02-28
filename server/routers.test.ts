import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import { COOKIE_NAME } from "../shared/const";
import type { TrpcContext } from "./_core/context";

type CookieCall = {
  name: string;
  options: Record<string, unknown>;
};

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(overrides?: Partial<AuthenticatedUser>): { ctx: TrpcContext; clearedCookies: CookieCall[] } {
  const clearedCookies: CookieCall[] = [];

  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user-123",
    email: "test@example.com",
    name: "Test User",
    loginMethod: "manus",
    role: "admin",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
    icNumber: null,
    phone: null,
    onboarded: false,
    ...overrides,
  };

  const ctx: TrpcContext = {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
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
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

describe("auth.me", () => {
  it("returns the authenticated user", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.me();
    expect(result).toBeDefined();
    expect(result?.openId).toBe("test-user-123");
    expect(result?.name).toBe("Test User");
    expect(result?.email).toBe("test@example.com");
  });

  it("returns null for unauthenticated user", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.me();
    expect(result).toBeNull();
  });
});

describe("auth.logout", () => {
  it("clears the session cookie and reports success", async () => {
    const { ctx, clearedCookies } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.auth.logout();

    expect(result).toEqual({ success: true });
    expect(clearedCookies).toHaveLength(1);
    expect(clearedCookies[0]?.name).toBe(COOKIE_NAME);
    expect(clearedCookies[0]?.options).toMatchObject({
      maxAge: -1,
      secure: true,
      sameSite: "none",
      httpOnly: true,
      path: "/",
    });
  });
});

describe("onboarding.updateProfile", () => {
  it("rejects unauthenticated users", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.onboarding.updateProfile({ name: "Test", icNumber: "900101-01-1234" })
    ).rejects.toThrow();
  });

  it("validates input - name is required", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.onboarding.updateProfile({ name: "", icNumber: "900101-01-1234" })
    ).rejects.toThrow();
  });

  it("validates input - icNumber is required", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.onboarding.updateProfile({ name: "Test User", icNumber: "" })
    ).rejects.toThrow();
  });
});

describe("company.create", () => {
  it("rejects unauthenticated users", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.company.create({
        name: "Test Sdn Bhd",
        companyType: "sdn_bhd",
        ssmNumber: "202301012345",
      })
    ).rejects.toThrow();
  });

  it("validates company type enum", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.company.create({
        name: "Test",
        companyType: "invalid_type" as any,
        ssmNumber: "123",
      })
    ).rejects.toThrow();
  });

  it("validates required fields", async () => {
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
});

describe("document.upload", () => {
  it("rejects unauthenticated users", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.document.upload({
        companyId: 1,
        docType: "receipt",
        fileName: "test.pdf",
        fileBase64: "dGVzdA==",
        mimeType: "application/pdf",
      })
    ).rejects.toThrow();
  });

  it("validates doc type enum", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.document.upload({
        companyId: 1,
        docType: "invalid" as any,
        fileName: "test.pdf",
        fileBase64: "dGVzdA==",
        mimeType: "application/pdf",
      })
    ).rejects.toThrow();
  });
});

describe("transaction.create", () => {
  it("rejects unauthenticated users", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.transaction.create({
        companyId: 1,
        date: "2024-01-01",
        description: "Test",
        amount: "100.00",
        transactionType: "debit",
      })
    ).rejects.toThrow();
  });

  it("validates transaction type enum", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.transaction.create({
        companyId: 1,
        date: "2024-01-01",
        description: "Test",
        amount: "100.00",
        transactionType: "invalid" as any,
      })
    ).rejects.toThrow();
  });
});

describe("incomeStatement.addLine", () => {
  it("rejects unauthenticated users", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.incomeStatement.addLine({
        companyId: 1,
        period: "2024-01",
        lineType: "revenue",
        description: "Test Revenue",
        amount: "5000.00",
      })
    ).rejects.toThrow();
  });

  it("validates line type enum", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.incomeStatement.addLine({
        companyId: 1,
        period: "2024-01",
        lineType: "invalid" as any,
        description: "Test",
        amount: "100.00",
      })
    ).rejects.toThrow();
  });
});

describe("financial.generateStatement", () => {
  it("rejects unauthenticated users", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.financial.generateStatement({
        companyId: 1,
        statementType: "profit_loss",
        period: "2024-01",
      })
    ).rejects.toThrow();
  });

  it("validates statement type enum", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.financial.generateStatement({
        companyId: 1,
        statementType: "invalid" as any,
        period: "2024-01",
      })
    ).rejects.toThrow();
  });
});

describe("advisor.startConversation", () => {
  it("rejects unauthenticated users", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.advisor.startConversation({
        companyId: 1,
        advisorType: "bookkeeper",
      })
    ).rejects.toThrow();
  });

  it("validates advisor type enum", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.advisor.startConversation({
        companyId: 1,
        advisorType: "invalid" as any,
      })
    ).rejects.toThrow();
  });
});

describe("advisor.sendMessage", () => {
  it("rejects unauthenticated users", async () => {
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
