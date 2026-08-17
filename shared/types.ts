/**
 * Unified type exports
 * Import shared types from this single entry point.
 */

export type * from "../drizzle/schema";
export * from "./_core/errors";

export type AdvisorType =
  | "bookkeeper"
  | "accountant"
  | "tax_agent"
  | "auditor"
  | "cfo";

export const ADVISOR_TYPES = [
  "bookkeeper",
  "accountant",
  "tax_agent",
  "auditor",
  "cfo",
] as const satisfies readonly AdvisorType[];

/** Max length of a custom advisor name. Mirrors advisor_name_overrides.name. */
export const ADVISOR_NAME_MAX_LENGTH = 40;

/**
 * Allowed shape of a custom advisor name.
 *
 * This is a deliberately narrow allowlist for names stored and rendered by the
 * application. Newlines, tabs, control characters, and structural punctuation
 * are rejected so names remain safe in UI and logs. Advisor names are display
 * data and are never included in the LLM's privileged system prompt.
 *
 * Unicode-aware (\p{L}/\p{M}) so non-Latin scripts and Malaysian naming
 * conventions still work — e.g. "Nurul 'Ain", "Abdul Rahman bin Ahmad",
 * "Muthu a/l Samy", "Mohd Ali @ Ahmad", "陈美玲".
 */
// Built via the RegExp constructor rather than a literal: this repo's tsconfig
// sets no `target`, so it defaults to ES5 and TS rejects the `u` flag on a
// regex literal (TS1501). Runtime support is fine on Node 18+ and all browsers
// the client targets.
export const ADVISOR_NAME_PATTERN = new RegExp(
  "^[\\p{L}\\p{M}][\\p{L}\\p{M}\\p{N} '’.\\-/@]*$",
  "u"
);

export const ADVISOR_NAME_ERROR =
  "Name must start with a letter and may only contain letters, numbers, spaces, apostrophes, periods, hyphens, slashes and @.";

export type CompanyType = "enterprise" | "plt" | "sdn_bhd" | "bhd";

export const COMPANY_TYPE_LABELS: Record<CompanyType, string> = {
  enterprise: "Enterprise / Sole Proprietorship",
  plt: "PLT (Perkongsian Liabiliti Terhad)",
  sdn_bhd: "Sdn Bhd (Sendirian Berhad)",
  bhd: "Bhd (Berhad)",
};

export const ADVISOR_PROFILES: Record<
  AdvisorType,
  {
    name: string;
    title: string;
    description: string;
    avatar: string;
    color: string;
  }
> = {
  bookkeeper: {
    name: "Sarah",
    title: "Senior Bookkeeper",
    description:
      "Meticulous and detail-oriented. Helps with daily entries, reconciliation, and keeping your books tidy.",
    avatar: "S",
    color: "#0d9488",
  },
  accountant: {
    name: "David",
    title: "Chartered Accountant",
    description:
      "Analytical and thorough. Reviews your financial records, ensures compliance, and prepares accurate reports.",
    avatar: "D",
    color: "#2563eb",
  },
  tax_agent: {
    name: "Amir",
    title: "Licensed Tax Agent",
    description:
      "Sharp and up-to-date with LHDN regulations. Optimises your tax position and ensures timely compliance.",
    avatar: "A",
    color: "#7c3aed",
  },
  auditor: {
    name: "Rachel",
    title: "Internal Auditor",
    description:
      "Independent and rigorous. Conducts thorough reviews of your financial statements and internal controls.",
    avatar: "R",
    color: "#dc2626",
  },
  cfo: {
    name: "James",
    title: "Chief Financial Officer",
    description:
      "Strategic and forward-thinking. Provides proactive financial advice and optimisation strategies.",
    avatar: "J",
    color: "#ca8a04",
  },
};

/**
 * Resolve an advisor's display name: a per-company override when one exists,
 * otherwise the built-in default from ADVISOR_PROFILES.
 * Shared by server and client so both sides fall back identically.
 */
export function resolveAdvisorName(
  advisorType: AdvisorType,
  overrides?: Partial<Record<AdvisorType, string>> | null
): string {
  const override = overrides?.[advisorType]?.trim();
  if (!override) return ADVISOR_PROFILES[advisorType].name;

  // Re-check at the point of use rather than trusting that it was validated on
  // the way in (rows predating validation, direct DB writes, future callers).
  if (
    override.length > ADVISOR_NAME_MAX_LENGTH ||
    !ADVISOR_NAME_PATTERN.test(override)
  ) {
    return ADVISOR_PROFILES[advisorType].name;
  }

  return override;
}

export const TRANSACTION_CATEGORIES = [
  "Sales Revenue",
  "Service Revenue",
  "Cost of Goods Sold",
  "Salaries & Wages",
  "Rent & Utilities",
  "Office Supplies",
  "Marketing & Advertising",
  "Professional Fees",
  "Travel & Entertainment",
  "Insurance",
  "Depreciation",
  "Interest Expense",
  "Bank Charges",
  "Tax Payment",
  "Loan Repayment",
  "Capital Expenditure",
  "Owner's Drawing",
  "Other Income",
  "Other Expense",
  "Transfer",
] as const;
