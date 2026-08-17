import { beforeEach, describe, expect, it, vi } from "vitest";

// The rest of the suite runs without a DATABASE_URL, so getMemberRole always
// resolves to null and owner-vs-staff branching is never exercised. This file
// mocks the data layer so the role tier of advisor.setName is actually tested.
vi.mock("./db", async importOriginal => {
  const actual = await importOriginal<typeof import("./db")>();
  return {
    ...actual,
    getMemberRole: vi.fn(),
    getAdvisorNameOverrides: vi.fn(async () => []),
    setAdvisorNameOverride: vi.fn(async () => {}),
    getCompanyById: vi.fn(async () => undefined),
  };
});

import { appRouter } from "./routers";
import * as db from "./db";
import type { TrpcContext } from "./_core/context";

const mockedDb = vi.mocked(db);

function callerForUser(userId = 1) {
  const ctx: TrpcContext = {
    user: {
      id: userId,
      openId: "sample-user",
      email: "sample@example.com",
      name: "Sample User",
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

beforeEach(() => {
  vi.clearAllMocks();
});

describe("advisor.setName role tier", () => {
  it("allows an owner to rename and persists the override", async () => {
    mockedDb.getMemberRole.mockResolvedValue("owner");

    const result = await callerForUser().advisor.setName({
      companyId: 7,
      advisorType: "bookkeeper",
      name: "Nadia",
    });

    expect(result).toEqual({ success: true, name: "Nadia" });
    expect(mockedDb.setAdvisorNameOverride).toHaveBeenCalledWith({
      companyId: 7,
      advisorType: "bookkeeper",
      name: "Nadia",
    });
  });

  it("forbids a staff member from renaming, and writes nothing", async () => {
    mockedDb.getMemberRole.mockResolvedValue("staff");

    expect(
      await errorCodeOf(
        callerForUser().advisor.setName({
          companyId: 7,
          advisorType: "bookkeeper",
          name: "Nadia",
        })
      )
    ).toBe("FORBIDDEN");

    // The important half: no company-wide write happened.
    expect(mockedDb.setAdvisorNameOverride).not.toHaveBeenCalled();
  });

  it("forbids a non-member from renaming, and writes nothing", async () => {
    mockedDb.getMemberRole.mockResolvedValue(null);

    expect(
      await errorCodeOf(
        callerForUser().advisor.setName({
          companyId: 7,
          advisorType: "bookkeeper",
          name: "Nadia",
        })
      )
    ).toBe("FORBIDDEN");
    expect(mockedDb.setAdvisorNameOverride).not.toHaveBeenCalled();
  });
});

describe("advisor.profiles role tier", () => {
  it("stays readable by staff", async () => {
    mockedDb.getMemberRole.mockResolvedValue("staff");

    const profiles = await callerForUser().advisor.profiles({ companyId: 7 });

    expect(profiles).toHaveLength(5);
    expect(profiles.map(p => p.advisorType)).toContain("bookkeeper");
  });

  it("stays readable by an owner", async () => {
    mockedDb.getMemberRole.mockResolvedValue("owner");

    const profiles = await callerForUser().advisor.profiles({ companyId: 7 });

    expect(profiles).toHaveLength(5);
  });

  it("is refused for a non-member", async () => {
    mockedDb.getMemberRole.mockResolvedValue(null);

    expect(
      await errorCodeOf(callerForUser().advisor.profiles({ companyId: 7 }))
    ).toBe("FORBIDDEN");
  });

  it("merges a stored override over the default name", async () => {
    mockedDb.getMemberRole.mockResolvedValue("staff");
    mockedDb.getAdvisorNameOverrides.mockResolvedValue([
      {
        id: 1,
        companyId: 7,
        advisorType: "bookkeeper",
        name: "Nadia",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    const profiles = await callerForUser().advisor.profiles({ companyId: 7 });
    const bookkeeper = profiles.find(p => p.advisorType === "bookkeeper");
    const cfo = profiles.find(p => p.advisorType === "cfo");

    expect(bookkeeper).toMatchObject({ name: "Nadia", isCustomName: true });
    expect(cfo).toMatchObject({ name: "James", isCustomName: false });
  });
});
