import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./db", async importOriginal => {
  const actual = await importOriginal<typeof import("./db")>();
  return {
    ...actual,
    getMemberRole: vi.fn(async () => "owner"),
    getDocuments: vi.fn(),
    claimDocumentForReprocessing: vi.fn(),
  };
});

vi.mock("./reprocessQueue", () => ({
  reprocessQueue: { enqueue: vi.fn(async () => {}) },
}));

import { appRouter } from "./routers";
import * as db from "./db";
import { reprocessQueue } from "./reprocessQueue";
import type { TrpcContext } from "./_core/context";

const mockedDb = vi.mocked(db);
const mockedEnqueue = vi.mocked(reprocessQueue.enqueue);

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

beforeEach(() => {
  vi.clearAllMocks();
  mockedDb.getDocuments.mockResolvedValue(failedDocuments);
});

describe("document.reprocessAll", () => {
  it("atomically claims and submits every eligible document", async () => {
    mockedDb.claimDocumentForReprocessing.mockResolvedValue(true);

    const result = await caller().document.reprocessAll({ companyId: 7 });

    expect(result).toEqual({ reprocessed: 12, total: 12 });
    expect(mockedDb.claimDocumentForReprocessing).toHaveBeenCalledTimes(12);
    expect(mockedEnqueue).toHaveBeenCalledTimes(12);
  });

  it("enqueues each document only once across overlapping requests", async () => {
    const claimed = new Set<number>();
    mockedDb.claimDocumentForReprocessing.mockImplementation(async id => {
      if (claimed.has(id)) return false;
      claimed.add(id);
      return true;
    });

    const [first, second] = await Promise.all([
      caller().document.reprocessAll({ companyId: 7 }),
      caller().document.reprocessAll({ companyId: 7 }),
    ]);

    expect(first.total).toBe(12);
    expect(second.total).toBe(12);
    expect(first.reprocessed + second.reprocessed).toBe(12);
    expect(mockedDb.claimDocumentForReprocessing).toHaveBeenCalledTimes(24);
    expect(mockedEnqueue).toHaveBeenCalledTimes(12);
  });
});
