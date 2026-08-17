import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./db", async importOriginal => {
  const actual = await importOriginal<typeof import("./db")>();
  return {
    ...actual,
    getMemberRole: vi.fn(async () => "owner"),
    createDocument: vi.fn(async () => 123),
    updateDocument: vi.fn(async () => {}),
    createTransaction: vi.fn(async () => 1),
    createTransactionsBatch: vi.fn(async () => {}),
  };
});

vi.mock("./storage", async importOriginal => {
  const actual = await importOriginal<typeof import("./storage")>();
  return {
    ...actual,
    storagePut: vi.fn(async (key: string) => ({
      key,
      url: "https://storage.example/uploaded-file",
    })),
  };
});

vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn(async () => ({
    choices: [
      {
        message: {
          content: JSON.stringify({
            extractedText: "test",
            vendor: null,
            date: null,
            total: null,
            currency: "MYR",
            items: [],
            taxAmount: null,
            invoiceNumber: null,
            documentType: "other",
            suggestedCategory: null,
            clarificationNeeded: [],
            transactions: null,
          }),
        },
      },
    ],
  })),
}));

import { appRouter } from "./routers";
import * as db from "./db";
import { storagePut } from "./storage";
import type { TrpcContext } from "./_core/context";

const mockedDb = vi.mocked(db);
const mockedStoragePut = vi.mocked(storagePut);

const COMPANY_ID = 7;
const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

function caller() {
  const ctx: TrpcContext = {
    user: {
      id: 42,
      openId: "uploader",
      email: "uploader@example.com",
      name: "Uploader",
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

describe("document upload security", () => {
  it("rejects an upload larger than 25 MiB before storage or database writes", async () => {
    const oversizedBase64 = "A".repeat(
      Math.ceil((MAX_UPLOAD_BYTES + 1) / 3) * 4
    );

    await expect(
      caller().document.upload({
        companyId: COMPANY_ID,
        docType: "other",
        fileName: "oversized.bin",
        fileBase64: oversizedBase64,
        mimeType: "application/octet-stream",
      })
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: expect.stringContaining("25 MiB upload limit"),
    });

    expect(mockedDb.getMemberRole).not.toHaveBeenCalled();
    expect(mockedStoragePut).not.toHaveBeenCalled();
    expect(mockedDb.createDocument).not.toHaveBeenCalled();
  });

  it.each(["../../evil.txt", "/etc/cron.d/evil", String.raw`..\..\evil.txt`])(
    "keeps a malicious filename inside the company directory: %s",
    async fileName => {
      await caller().document.upload({
        companyId: COMPANY_ID,
        docType: "other",
        fileName,
        fileBase64: Buffer.from("safe content").toString("base64"),
        mimeType: "text/plain",
      });

      const storageKey = mockedStoragePut.mock.calls[0]?.[0];
      expect(storageKey).toMatch(/^docs\/7\/[^/\\]+$/);
      expect(storageKey).not.toContain("..");
      expect(mockedDb.createDocument).toHaveBeenCalledWith(
        expect.objectContaining({
          fileName,
          fileKey: storageKey,
        })
      );
    }
  );

  it.each([
    ["invoice", "invoice-August 2026.pdf", "application/pdf"],
    ["receipt", "receipt-photo.jpg", "image/jpeg"],
    ["bank_statement", "transactions.csv", "text/csv"],
  ] as const)(
    "keeps a normal %s filename unchanged in the generated key",
    async (docType, fileName, mimeType) => {
      await caller().document.upload({
        companyId: COMPANY_ID,
        docType,
        fileName,
        fileBase64: Buffer.from("pdf content").toString("base64"),
        mimeType,
      });

      expect(mockedStoragePut.mock.calls[0]?.[0]).toMatch(
        new RegExp(`^docs/7/[A-Za-z0-9_-]+-${fileName.replace(".", "\\.")}$`)
      );
    }
  );
});
