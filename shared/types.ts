/**
 * Unified type exports
 * Import shared types from this single entry point.
 */

export type * from "../drizzle/schema";
export * from "./_core/errors";

export type AdvisorType = "bookkeeper" | "accountant" | "tax_agent" | "auditor" | "cfo";

export type CompanyType = "enterprise" | "plt" | "sdn_bhd" | "bhd";

export const COMPANY_TYPE_LABELS: Record<CompanyType, string> = {
  enterprise: "Enterprise / Sole Proprietorship",
  plt: "PLT (Perkongsian Liabiliti Terhad)",
  sdn_bhd: "Sdn Bhd (Sendirian Berhad)",
  bhd: "Bhd (Berhad)",
};

export const ADVISOR_PROFILES: Record<AdvisorType, {
  name: string;
  title: string;
  description: string;
  avatar: string;
  color: string;
}> = {
  bookkeeper: {
    name: "Sarah",
    title: "Senior Bookkeeper",
    description: "Meticulous and detail-oriented. Helps with daily entries, reconciliation, and keeping your books tidy.",
    avatar: "S",
    color: "#0d9488",
  },
  accountant: {
    name: "David",
    title: "Chartered Accountant",
    description: "Analytical and thorough. Reviews your financial records, ensures compliance, and prepares accurate reports.",
    avatar: "D",
    color: "#2563eb",
  },
  tax_agent: {
    name: "Amir",
    title: "Licensed Tax Agent",
    description: "Sharp and up-to-date with LHDN regulations. Optimises your tax position and ensures timely compliance.",
    avatar: "A",
    color: "#7c3aed",
  },
  auditor: {
    name: "Rachel",
    title: "Internal Auditor",
    description: "Independent and rigorous. Conducts thorough reviews of your financial statements and internal controls.",
    avatar: "R",
    color: "#dc2626",
  },
  cfo: {
    name: "James",
    title: "Chief Financial Officer",
    description: "Strategic and forward-thinking. Provides proactive financial advice and optimisation strategies.",
    avatar: "J",
    color: "#ca8a04",
  },
};

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
