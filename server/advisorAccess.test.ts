import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./db", async importOriginal => {
  const actual = await importOriginal<typeof import("./db")>();
  return {
    ...actual,
    getMemberRole: vi.fn(),
    getCompanyById: vi.fn(),
    getConversationById: vi.fn(),
    getConversations: vi.fn(async () => []),
    getTransactions: vi.fn(async () => []),
    getIncomeStatementLines: vi.fn(async () => []),
    getDocuments: vi.fn(async () => []),
    updateConversation: vi.fn(async () => {}),
    createConversation: vi.fn(async () => 1),
  };
});

vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn(async () => ({
    choices: [{ message: { content: "Mock advisor response" } }],
  })),
}));

import { appRouter } from "./routers";
import * as db from "./db";
import { invokeLLM } from "./_core/llm";
import type { TrpcContext } from "./_core/context";

const mockedDb = vi.mocked(db);
const mockedInvokeLLM = vi.mocked(invokeLLM);

const CALLER_ID = 42;
const OWN_COMPANY = 1;
const VICTIM_COMPANY = 99;

function caller() {
  const ctx: TrpcContext = {
    user: {
      id: CALLER_ID,
      openId: "attacker",
      email: "attacker@example.com",
      name: "Attacker",
      loginMethod: "manus",
      role: "user",
      icNumber: null,
      phone: null,
      onboarded: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => {} } as unknown as TrpcContext["res"],
  };
  return appRouter.createCaller(ctx);
}

async function errorCodeOf(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (error: any) {
    return error?.code ?? "UNKNOWN";
  }
  throw new Error("Expected the procedure to reject, but it resolved");
}

const victimConversation = {
  id: 500,
  companyId: VICTIM_COMPANY,
  userId: 7,
  advisorType: "cfo",
  title: "Victim planning",
  messages: [{ role: "system", content: "Victim context", timestamp: 1 }],
  createdAt: new Date(),
  updatedAt: new Date(),
} as any;

beforeEach(() => {
  vi.clearAllMocks();
  mockedDb.getMemberRole.mockImplementation(async companyId =>
    companyId === OWN_COMPANY ? "owner" : null
  );
  mockedDb.getConversationById.mockResolvedValue(victimConversation);
  mockedDb.getCompanyById.mockResolvedValue({
    id: VICTIM_COMPANY,
    name: "Victim Sdn Bhd",
    companyType: "sdn_bhd",
    ssmNumber: "202301099999",
    taxNumber: "C-9999",
    ownerIc: "900101-01-1234",
  } as any);
});

describe("advisor tenant isolation", () => {
  it("rejects sendMessage for a conversation owned by another company before reading financial data", async () => {
    expect(
      await errorCodeOf(
        caller().advisor.sendMessage({
          conversationId: victimConversation.id,
          message: "Summarise the company's finances",
        })
      )
    ).toBe("FORBIDDEN");

    expect(mockedDb.getTransactions).not.toHaveBeenCalled();
    expect(mockedDb.getIncomeStatementLines).not.toHaveBeenCalled();
    expect(mockedDb.getDocuments).not.toHaveBeenCalled();
    expect(mockedInvokeLLM).not.toHaveBeenCalled();
    expect(mockedDb.updateConversation).not.toHaveBeenCalled();
  });

  it("rejects listConversations for a company the caller does not belong to", async () => {
    expect(
      await errorCodeOf(
        caller().advisor.listConversations({ companyId: VICTIM_COMPANY })
      )
    ).toBe("FORBIDDEN");
    expect(mockedDb.getConversations).not.toHaveBeenCalled();
  });

  it("rejects startConversation for a company the caller does not belong to", async () => {
    expect(
      await errorCodeOf(
        caller().advisor.startConversation({
          companyId: VICTIM_COMPANY,
          advisorType: "cfo",
        })
      )
    ).toBe("FORBIDDEN");
    expect(mockedDb.createConversation).not.toHaveBeenCalled();
  });
});

describe("company profile tenant isolation", () => {
  it("rejects company.getById for a company the caller does not belong to", async () => {
    expect(
      await errorCodeOf(caller().company.getById({ id: VICTIM_COMPANY }))
    ).toBe("FORBIDDEN");
    expect(mockedDb.getCompanyById).not.toHaveBeenCalled();
  });
});

describe("same-company advisor access", () => {
  beforeEach(() => {
    mockedDb.getConversationById.mockResolvedValue({
      ...victimConversation,
      companyId: OWN_COMPANY,
      userId: CALLER_ID,
    });
  });

  it("continues to allow a member to send an advisor message", async () => {
    const result = await caller().advisor.sendMessage({
      conversationId: victimConversation.id,
      message: "How are we doing?",
    });

    expect(result.content).toBe("Mock advisor response");
    expect(mockedDb.getTransactions).toHaveBeenCalledWith(OWN_COMPANY, 50, 0);
    expect(mockedDb.updateConversation).toHaveBeenCalled();
  });

  it("continues to scope conversation lists to the authenticated user", async () => {
    await caller().advisor.listConversations({ companyId: OWN_COMPANY });
    expect(mockedDb.getConversations).toHaveBeenCalledWith(
      OWN_COMPANY,
      CALLER_ID,
      undefined
    );
  });
});
