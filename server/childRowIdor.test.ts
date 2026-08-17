import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./db", async importOriginal => {
  const actual = await importOriginal<typeof import("./db")>();
  return {
    ...actual,
    getMemberRole: vi.fn(),
    getCompanyMemberById: vi.fn(),
    getIncomeStatementLineById: vi.fn(),
    updateCompanyMember: vi.fn(async () => {}),
    removeCompanyMember: vi.fn(async () => {}),
    deleteIncomeStatementLine: vi.fn(async () => {}),
  };
});

import type { TrpcContext } from "./_core/context";
import * as db from "./db";
import { appRouter } from "./routers";

const mockedDb = vi.mocked(db);
const USER_ID = 42;
const OWN_COMPANY = 1;
const VICTIM_COMPANY = 99;

function caller() {
  const ctx: TrpcContext = {
    user: {
      id: USER_ID,
      openId: "owner",
      email: "owner@example.com",
      name: "Owner",
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

async function errorCodeOf(promise: Promise<unknown>) {
  try {
    await promise;
  } catch (error: any) {
    return error?.code;
  }
  throw new Error("Expected procedure to reject");
}

const member = {
  id: 500,
  companyId: VICTIM_COMPANY,
  userId: 7,
  memberRole: "staff",
  accessLevel: "limited",
  permissions: null,
  createdAt: new Date(),
  updatedAt: new Date(),
} as any;

const incomeLine = {
  id: 600,
  companyId: VICTIM_COMPANY,
  period: "2026-01",
  lineType: "revenue",
  description: "Victim revenue",
  amount: "1000.00",
  accountId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
} as any;

beforeEach(() => {
  vi.clearAllMocks();
  mockedDb.getMemberRole.mockImplementation(async companyId =>
    companyId === OWN_COMPANY ? "owner" : null
  );
  mockedDb.getCompanyMemberById.mockResolvedValue(member);
  mockedDb.getIncomeStatementLineById.mockResolvedValue(incomeLine);
});

describe("child-row procedures reject paired-company IDORs", () => {
  it("company.updateMember cannot mutate another company's membership", async () => {
    expect(
      await errorCodeOf(
        caller().company.updateMember({
          companyId: OWN_COMPANY,
          memberId: member.id,
          accessLevel: "full",
        })
      )
    ).toBe("FORBIDDEN");
    expect(mockedDb.updateCompanyMember).not.toHaveBeenCalled();
  });

  it("company.removeMember cannot delete another company's membership", async () => {
    expect(
      await errorCodeOf(
        caller().company.removeMember({
          companyId: OWN_COMPANY,
          memberId: member.id,
        })
      )
    ).toBe("FORBIDDEN");
    expect(mockedDb.removeCompanyMember).not.toHaveBeenCalled();
  });

  it("incomeStatement.deleteLine cannot delete another company's line", async () => {
    expect(
      await errorCodeOf(
        caller().incomeStatement.deleteLine({
          companyId: OWN_COMPANY,
          lineId: incomeLine.id,
        })
      )
    ).toBe("FORBIDDEN");
    expect(mockedDb.deleteIncomeStatementLine).not.toHaveBeenCalled();
  });
});

describe("same-company child-row mutations are unaffected", () => {
  beforeEach(() => {
    mockedDb.getCompanyMemberById.mockResolvedValue({
      ...member,
      companyId: OWN_COMPANY,
    });
    mockedDb.getIncomeStatementLineById.mockResolvedValue({
      ...incomeLine,
      companyId: OWN_COMPANY,
    });
  });

  it("updates a member", async () => {
    await expect(
      caller().company.updateMember({
        companyId: OWN_COMPANY,
        memberId: member.id,
        memberRole: "owner",
      })
    ).resolves.toEqual({ success: true });
    expect(mockedDb.updateCompanyMember).toHaveBeenCalledOnce();
  });

  it("removes a member", async () => {
    await expect(
      caller().company.removeMember({
        companyId: OWN_COMPANY,
        memberId: member.id,
      })
    ).resolves.toEqual({ success: true });
    expect(mockedDb.removeCompanyMember).toHaveBeenCalledOnce();
  });

  it("deletes an income statement line", async () => {
    await expect(
      caller().incomeStatement.deleteLine({
        companyId: OWN_COMPANY,
        lineId: incomeLine.id,
      })
    ).resolves.toEqual({ success: true });
    expect(mockedDb.deleteIncomeStatementLine).toHaveBeenCalledOnce();
  });
});
