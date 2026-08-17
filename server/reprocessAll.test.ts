import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./db", async importOriginal => {
  const actual = await importOriginal<typeof import("./db")>();
  return {
    ...actual,
    getMemberRole: vi.fn(async () => "owner"),
    getDocuments: vi.fn(),
    updateDocument: vi.fn(async () => {}),
  };
});

vi.mock("./reprocessQueue", () => ({
  getReprocessConcurrency: vi.fn(() => 3),
  runWithConcurrencyLimit: vi.fn(async () => {}),
}));

import { appRouter } from "./routers";
import * as db from "./db";
import { runWithConcurrencyLimit } from "./reprocessQueue";
import type { TrpcContext } from "./_core/context";

const mockedDb = vi.mocked(db);
const mockedRunWithConcurrencyLimit = vi.mocked(runWithConcurrencyLimit);

function caller() {
  const ctx: TrpcContext = {
    user: {
      id: 42,
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

beforeEach(() => {
  vi.clearAllMocks();
});

describe("document.reprocessAll", () => {
  it("marks the backlog processing and submits one bounded background queue", async () => {
    const failedDocuments = Array.from({ length: 12 }, (_, index) => ({
      id: index + 1,
      companyId: 7,
      status: "error",
      ocrData: null,
      fileUrl: `https://storage.example/${index + 1}`,
      fileName: `${index + 1}.pdf`,
      docType: "invoice",
      mimeType: "application/pdf",
    })) as any[];
    mockedDb.getDocuments.mockResolvedValue(failedDocuments);

    const result = await caller().document.reprocessAll({ companyId: 7 });

    expect(result).toEqual({ reprocessed: 12, total: 12 });
    expect(mockedDb.updateDocument).toHaveBeenCalledTimes(12);
    for (const document of failedDocuments) {
      expect(mockedDb.updateDocument).toHaveBeenCalledWith(document.id, {
        status: "processing",
      });
    }
    expect(mockedRunWithConcurrencyLimit).toHaveBeenCalledTimes(1);
    expect(mockedRunWithConcurrencyLimit).toHaveBeenCalledWith(
      failedDocuments,
      3,
      expect.any(Function)
    );
  });
});
