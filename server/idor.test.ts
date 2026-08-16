import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Regression tests for TICKET-2 (IDOR on document & transaction procedures).
 *
 * The plain suite runs without a DATABASE_URL, so db.getMemberRole always
 * resolves null and every caller looks like a non-member — which cannot
 * distinguish "correctly rejected an outsider" from "rejected everyone".
 * Mocking the data layer lets us assert both halves: the wrong-company user is
 * refused, and the same-company user is still allowed through unchanged.
 */
vi.mock("./db", async importOriginal => {
  const actual = await importOriginal<typeof import("./db")>();
  return {
    ...actual,
    getMemberRole: vi.fn(),
    getDocumentById: vi.fn(),
    getTransactionById: vi.fn(),
    getCompanyById: vi.fn(),
    getDocuments: vi.fn(async () => []),
    getTransactions: vi.fn(async () => []),
    getChartOfAccounts: vi.fn(async () => []),
    getStaffInputSummary: vi.fn(async () => ({}) as any),
    updateTransaction: vi.fn(async () => {}),
    createTransaction: vi.fn(async () => 1),
    deleteTransaction: vi.fn(async () => {}),
    updateDocument: vi.fn(async () => {}),
    deleteTransactionsByDocumentId: vi.fn(async () => {}),
  };
});

import { appRouter } from "./routers";
import * as db from "./db";
import type { TrpcContext } from "./_core/context";

const mockedDb = vi.mocked(db);

/** The attacker: authenticated, but a member of company 1 only. */
const ATTACKER_ID = 42;
/** The victim's company, which the attacker does not belong to. */
const VICTIM_COMPANY = 99;
const OWN_COMPANY = 1;

function caller(userId = ATTACKER_ID) {
  const ctx: TrpcContext = {
    user: {
      id: userId,
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
    } as NonNullable<TrpcContext["user"]>,
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

/** Membership oracle: the attacker belongs to OWN_COMPANY and nothing else. */
function membershipIsRealistic() {
  mockedDb.getMemberRole.mockImplementation(async (companyId: number) =>
    companyId === OWN_COMPANY ? "owner" : (null as any)
  );
}

const victimDocument = {
  id: 500,
  companyId: VICTIM_COMPANY,
  uploadedBy: 7,
  docType: "bank_statement",
  fileName: "victim-statement.pdf",
  fileUrl: "https://storage.example/victim-statement.pdf",
  fileKey: "docs/99/victim-statement.pdf",
  mimeType: "application/pdf",
  ocrText: "sensitive extracted text",
  ocrData: { vendor: "Victim Vendor", total: 1234.56 },
  status: "processed",
  clarificationNote: null,
  createdAt: new Date(),
  updatedAt: new Date(),
} as any;

const victimTransaction = {
  id: 600,
  companyId: VICTIM_COMPANY,
  documentId: 500,
  date: new Date(),
  description: "Victim payment",
  amount: "1234.56",
  transactionType: "debit",
  category: "Office Supplies",
  accountId: null,
  autoCategory: null,
  autoCategoryConfidence: null,
  manualOverride: false,
  notes: null,
  reference: null,
  createdAt: new Date(),
  updatedAt: new Date(),
} as any;

beforeEach(() => {
  vi.clearAllMocks();
  membershipIsRealistic();
  mockedDb.getDocumentById.mockResolvedValue(victimDocument);
  mockedDb.getTransactionById.mockResolvedValue(victimTransaction);
  mockedDb.getCompanyById.mockResolvedValue({
    id: VICTIM_COMPANY,
    name: "Victim Sdn Bhd",
    ssmNumber: "202301099999",
    ownerIc: "900101-01-1234",
  } as any);
});

describe("document procedures reject cross-company access", () => {
  it("document.getById does not leak another company's document", async () => {
    expect(await errorCodeOf(caller().document.getById({ id: 500 }))).toBe(
      "FORBIDDEN"
    );
  });

  it("document.processWithOCR does not reprocess another company's document", async () => {
    expect(
      await errorCodeOf(caller().document.processWithOCR({ documentId: 500 }))
    ).toBe("FORBIDDEN");
    // No paid LLM work and no state mutation may occur.
    expect(mockedDb.updateDocument).not.toHaveBeenCalled();
    expect(mockedDb.deleteTransactionsByDocumentId).not.toHaveBeenCalled();
  });

  it("document.respondToClarification does not write to another company's document", async () => {
    expect(
      await errorCodeOf(
        caller().document.respondToClarification({
          documentId: 500,
          response: "injected clarification",
        })
      )
    ).toBe("FORBIDDEN");
    expect(mockedDb.updateDocument).not.toHaveBeenCalled();
  });

  it("document.list still rejects a company the caller does not belong to", async () => {
    expect(
      await errorCodeOf(caller().document.list({ companyId: VICTIM_COMPANY }))
    ).toBe("FORBIDDEN");
  });
});

describe("transaction procedures reject cross-company access", () => {
  it("transaction.categorizeStatement does not touch another company's document", async () => {
    expect(
      await errorCodeOf(
        caller().transaction.categorizeStatement({
          companyId: OWN_COMPANY, // attacker's own company, foreign document
          documentId: 500,
        })
      )
    ).toBe("FORBIDDEN");
    expect(mockedDb.deleteTransactionsByDocumentId).not.toHaveBeenCalled();
    expect(mockedDb.updateDocument).not.toHaveBeenCalled();
  });

  it("transaction.updateCategory does not edit another company's transaction", async () => {
    expect(
      await errorCodeOf(
        caller().transaction.updateCategory({
          transactionId: 600,
          category: "Tampered",
        })
      )
    ).toBe("FORBIDDEN");
    expect(mockedDb.updateTransaction).not.toHaveBeenCalled();
  });

  it("transaction.create does not write into another company's books", async () => {
    expect(
      await errorCodeOf(
        caller().transaction.create({
          companyId: VICTIM_COMPANY,
          date: "2025-01-01",
          description: "Fabricated",
          amount: "9999.00",
          transactionType: "debit",
        })
      )
    ).toBe("FORBIDDEN");
    expect(mockedDb.createTransaction).not.toHaveBeenCalled();
  });

  it("transaction.delete does not delete another company's transaction when paired with the caller's own companyId", async () => {
    expect(
      await errorCodeOf(
        caller().transaction.delete({
          transactionId: 600,
          companyId: OWN_COMPANY, // the bypass the old check permitted
        })
      )
    ).toBe("FORBIDDEN");
    expect(mockedDb.deleteTransaction).not.toHaveBeenCalled();
  });
});

describe("company-scoped reads reject cross-company access", () => {
  it("company.getById does not leak registration details (SSM, owner IC)", async () => {
    expect(
      await errorCodeOf(caller().company.getById({ id: VICTIM_COMPANY }))
    ).toBe("FORBIDDEN");
  });

  it("company.getChartOfAccounts does not leak another company's accounts", async () => {
    expect(
      await errorCodeOf(
        caller().company.getChartOfAccounts({ companyId: VICTIM_COMPANY })
      )
    ).toBe("FORBIDDEN");
  });

  it("staff.summary does not leak another company's financial totals", async () => {
    expect(
      await errorCodeOf(caller().staff.summary({ companyId: VICTIM_COMPANY }))
    ).toBe("FORBIDDEN");
  });
});

/**
 * The other half of the acceptance criteria: legitimate same-company access
 * must be unchanged. Without these, the fix could pass by rejecting everyone.
 */
describe("same-company access is unaffected", () => {
  beforeEach(() => {
    mockedDb.getDocumentById.mockResolvedValue({
      ...victimDocument,
      companyId: OWN_COMPANY,
    });
    mockedDb.getTransactionById.mockResolvedValue({
      ...victimTransaction,
      companyId: OWN_COMPANY,
    });
    mockedDb.getCompanyById.mockResolvedValue({
      id: OWN_COMPANY,
      name: "My Sdn Bhd",
    } as any);
  });

  it("document.getById returns the caller's own document", async () => {
    const doc = await caller().document.getById({ id: 500 });
    expect(doc).toMatchObject({ id: 500, companyId: OWN_COMPANY });
  });

  it("transaction.updateCategory updates the caller's own transaction", async () => {
    const result = await caller().transaction.updateCategory({
      transactionId: 600,
      category: "Rent & Utilities",
    });
    expect(result).toEqual({ success: true });
    expect(mockedDb.updateTransaction).toHaveBeenCalledWith(600, {
      category: "Rent & Utilities",
      accountId: undefined,
      manualOverride: true,
    });
  });

  it("transaction.create writes into the caller's own company", async () => {
    const result = await caller().transaction.create({
      companyId: OWN_COMPANY,
      date: "2025-01-01",
      description: "Legitimate expense",
      amount: "10.00",
      transactionType: "debit",
    });
    expect(result).toEqual({ id: 1 });
    expect(mockedDb.createTransaction).toHaveBeenCalledWith(
      expect.objectContaining({ companyId: OWN_COMPANY })
    );
  });

  it("transaction.delete deletes the caller's own transaction", async () => {
    const result = await caller().transaction.delete({
      transactionId: 600,
      companyId: OWN_COMPANY,
    });
    expect(result).toEqual({ success: true });
    expect(mockedDb.deleteTransaction).toHaveBeenCalledWith(600);
  });

  it("company.getChartOfAccounts returns the caller's own accounts", async () => {
    await expect(
      caller().company.getChartOfAccounts({ companyId: OWN_COMPANY })
    ).resolves.toEqual([]);
  });

  it("staff.summary returns the caller's own company summary", async () => {
    await expect(
      caller().staff.summary({ companyId: OWN_COMPANY })
    ).resolves.toBeDefined();
  });
});

describe("missing rows still report NOT_FOUND", () => {
  it("document.getById reports NOT_FOUND for an id that does not exist", async () => {
    mockedDb.getDocumentById.mockResolvedValue(undefined);
    expect(await errorCodeOf(caller().document.getById({ id: 12345 }))).toBe(
      "NOT_FOUND"
    );
  });

  it("transaction.updateCategory reports NOT_FOUND for an id that does not exist", async () => {
    mockedDb.getTransactionById.mockResolvedValue(undefined);
    expect(
      await errorCodeOf(
        caller().transaction.updateCategory({
          transactionId: 12345,
          category: "x",
        })
      )
    ).toBe("NOT_FOUND");
  });
});
