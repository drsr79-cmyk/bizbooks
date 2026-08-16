import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import { getAdvisorSystemPrompt } from "./advisorPrompts";
import {
  ADVISOR_NAME_MAX_LENGTH,
  ADVISOR_PROFILES,
  ADVISOR_TYPES,
  resolveAdvisorName,
} from "../shared/types";
import type { AdvisorType } from "../shared/types";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(
  overrides?: Partial<AuthenticatedUser>
): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "sample-user",
    email: "sample@example.com",
    name: "Sample User",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
    ...overrides,
  };
  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => {} } as unknown as TrpcContext["res"],
  };
}

function createUnauthContext(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => {} } as unknown as TrpcContext["res"],
  };
}

/** Capture the tRPC error code thrown by a procedure call. */
async function expectTrpcError(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (error: any) {
    return error?.code ?? error?.cause?.code ?? "UNKNOWN";
  }
  throw new Error("Expected the procedure to reject, but it resolved");
}

describe("resolveAdvisorName", () => {
  it("falls back to the built-in default when no override exists", () => {
    for (const advisorType of ADVISOR_TYPES) {
      expect(resolveAdvisorName(advisorType, {})).toBe(
        ADVISOR_PROFILES[advisorType].name
      );
      expect(resolveAdvisorName(advisorType, null)).toBe(
        ADVISOR_PROFILES[advisorType].name
      );
      expect(resolveAdvisorName(advisorType)).toBe(
        ADVISOR_PROFILES[advisorType].name
      );
    }
  });

  it("returns the override when one is set", () => {
    expect(resolveAdvisorName("bookkeeper", { bookkeeper: "Nadia" })).toBe(
      "Nadia"
    );
  });

  it("ignores empty or whitespace-only overrides", () => {
    expect(resolveAdvisorName("cfo", { cfo: "" })).toBe(
      ADVISOR_PROFILES.cfo.name
    );
    expect(resolveAdvisorName("cfo", { cfo: "   " })).toBe(
      ADVISOR_PROFILES.cfo.name
    );
  });

  it("only overrides the advisor it is keyed to", () => {
    const overrides: Partial<Record<AdvisorType, string>> = {
      auditor: "Farah",
    };
    expect(resolveAdvisorName("auditor", overrides)).toBe("Farah");
    expect(resolveAdvisorName("accountant", overrides)).toBe(
      ADVISOR_PROFILES.accountant.name
    );
  });
});

describe("getAdvisorSystemPrompt", () => {
  it("interpolates the resolved name for every advisor type", () => {
    for (const advisorType of ADVISOR_TYPES) {
      const prompt = getAdvisorSystemPrompt(
        advisorType,
        "Zulkifli",
        "Acme Sdn Bhd",
        "sdn_bhd"
      );
      expect(prompt).toContain("You are Zulkifli,");
    }
  });

  it("does not leak the default name once overridden", () => {
    for (const advisorType of ADVISOR_TYPES) {
      const defaultName = ADVISOR_PROFILES[advisorType].name;
      const prompt = getAdvisorSystemPrompt(
        advisorType,
        "Zulkifli",
        "Acme Sdn Bhd",
        "sdn_bhd"
      );
      expect(prompt).not.toContain(defaultName);
    }
  });

  it("uses the built-in default when that is what was resolved", () => {
    for (const advisorType of ADVISOR_TYPES) {
      const defaultName = ADVISOR_PROFILES[advisorType].name;
      const prompt = getAdvisorSystemPrompt(
        advisorType,
        defaultName,
        "Acme Sdn Bhd",
        "sdn_bhd"
      );
      expect(prompt).toContain(`You are ${defaultName},`);
    }
  });

  it("still includes company context alongside the custom name", () => {
    const prompt = getAdvisorSystemPrompt(
      "tax_agent",
      "Zulkifli",
      "Acme Sdn Bhd",
      "sdn_bhd"
    );
    expect(prompt).toContain("Acme Sdn Bhd");
    expect(prompt).toContain("Malaysia");
  });
});

describe("advisor name router", () => {
  it("exposes the profiles and setName procedures", () => {
    const routerKeys = Object.keys(appRouter._def.procedures);
    expect(routerKeys).toContain("advisor.profiles");
    expect(routerKeys).toContain("advisor.setName");
  });

  it("requires authentication", async () => {
    const caller = appRouter.createCaller(createUnauthContext());
    expect(
      await expectTrpcError(caller.advisor.profiles({ companyId: 1 }))
    ).toBe("UNAUTHORIZED");
    expect(
      await expectTrpcError(
        caller.advisor.setName({
          companyId: 1,
          advisorType: "bookkeeper",
          name: "Nadia",
        })
      )
    ).toBe("UNAUTHORIZED");
  });

  it("forbids callers who are not members of the company", async () => {
    const caller = appRouter.createCaller(createAuthContext());
    expect(
      await expectTrpcError(caller.advisor.profiles({ companyId: 999 }))
    ).toBe("FORBIDDEN");
    expect(
      await expectTrpcError(
        caller.advisor.setName({
          companyId: 999,
          advisorType: "bookkeeper",
          name: "Nadia",
        })
      )
    ).toBe("FORBIDDEN");
  });

  it("forbids starting a conversation for a company the caller is not a member of", async () => {
    const caller = appRouter.createCaller(createAuthContext());
    expect(
      await expectTrpcError(
        caller.advisor.startConversation({ companyId: 999, advisorType: "cfo" })
      )
    ).toBe("FORBIDDEN");
  });

  it("rejects an empty or whitespace-only name", async () => {
    const caller = appRouter.createCaller(createAuthContext());
    for (const name of ["", "   "]) {
      expect(
        await expectTrpcError(
          caller.advisor.setName({
            companyId: 1,
            advisorType: "bookkeeper",
            name,
          })
        )
      ).toBe("BAD_REQUEST");
    }
  });

  it("rejects a name longer than the shared max length", async () => {
    const caller = appRouter.createCaller(createAuthContext());
    expect(
      await expectTrpcError(
        caller.advisor.setName({
          companyId: 1,
          advisorType: "bookkeeper",
          name: "a".repeat(ADVISOR_NAME_MAX_LENGTH + 1),
        })
      )
    ).toBe("BAD_REQUEST");
  });

  it("rejects an unknown advisor type", async () => {
    const caller = appRouter.createCaller(createAuthContext());
    expect(
      await expectTrpcError(
        caller.advisor.setName({
          companyId: 1,
          advisorType: "chief_vibes_officer" as AdvisorType,
          name: "Nadia",
        })
      )
    ).toBe("BAD_REQUEST");
  });
});
