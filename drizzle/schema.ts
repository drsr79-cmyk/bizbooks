import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, decimal, bigint, json, boolean, foreignKey, uniqueIndex } from "drizzle-orm/mysql-core";

// ─── Users ───────────────────────────────────────────────────────────
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  icNumber: varchar("icNumber", { length: 20 }),
  phone: varchar("phone", { length: 20 }),
  onboarded: boolean("onboarded").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ─── Companies ───────────────────────────────────────────────────────
export const companies = mysqlTable("companies", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  companyType: mysqlEnum("companyType", ["enterprise", "plt", "sdn_bhd", "bhd"]).notNull(),
  ssmNumber: varchar("ssmNumber", { length: 50 }).notNull(),
  taxNumber: varchar("taxNumber", { length: 50 }),
  ownerName: varchar("ownerName", { length: 255 }),
  ownerIc: varchar("ownerIc", { length: 20 }),
  address: text("address"),
  financialYearEnd: varchar("financialYearEnd", { length: 5 }), // MM-DD
  currency: varchar("currency", { length: 3 }).default("MYR").notNull(),
  createdBy: int("createdBy").notNull().references(() => users.id, { onDelete: "restrict" }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Company = typeof companies.$inferSelect;
export type InsertCompany = typeof companies.$inferInsert;

// ─── Company Members (role-based access) ─────────────────────────────
export const companyMembers = mysqlTable(
  "company_members",
  {
    id: int("id").autoincrement().primaryKey(),
    companyId: int("companyId").notNull().references(() => companies.id, { onDelete: "cascade" }),
    userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
    memberRole: mysqlEnum("memberRole", ["owner", "staff"]).notNull(),
    accessLevel: mysqlEnum("accessLevel", ["full", "limited"]).default("full").notNull(),
    permissions: json("permissions"), // JSON array of permission strings
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [uniqueIndex("company_members_company_user_unique").on(table.companyId, table.userId)]
);

export type CompanyMember = typeof companyMembers.$inferSelect;
export type InsertCompanyMember = typeof companyMembers.$inferInsert;

// ─── Chart of Accounts ──────────────────────────────────────────────
export const chartOfAccounts = mysqlTable(
  "chart_of_accounts",
  {
    id: int("id").autoincrement().primaryKey(),
    companyId: int("companyId").notNull().references(() => companies.id, { onDelete: "restrict" }),
    code: varchar("code", { length: 20 }).notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    accountType: mysqlEnum("accountType", [
      "asset", "liability", "equity", "revenue", "expense"
    ]).notNull(),
    subType: varchar("subType", { length: 100 }),
    parentId: int("parentId"),
    isDefault: boolean("isDefault").default(false).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [
    uniqueIndex("chart_of_accounts_id_company_unique").on(table.id, table.companyId),
    foreignKey({
      columns: [table.parentId, table.companyId],
      foreignColumns: [table.id, table.companyId],
      name: "chart_of_accounts_parent_company_fk",
    }).onDelete("restrict"),
  ]
);

export type ChartOfAccount = typeof chartOfAccounts.$inferSelect;

// ─── Documents (receipts, invoices, bank statements, etc.) ──────────
export const documents = mysqlTable("documents", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("companyId").notNull().references(() => companies.id, { onDelete: "restrict" }),
  uploadedBy: int("uploadedBy").notNull(),
  docType: mysqlEnum("docType", [
    "receipt", "invoice", "bank_statement", "credit_card_statement", "income_statement", "other"
  ]).notNull(),
  fileName: varchar("fileName", { length: 500 }).notNull(),
  fileUrl: text("fileUrl").notNull(),
  fileKey: varchar("fileKey", { length: 500 }).notNull(),
  mimeType: varchar("mimeType", { length: 100 }),
  ocrText: text("ocrText"),
  ocrData: json("ocrData"), // structured OCR result
  status: mysqlEnum("status", ["pending", "processing", "processed", "error", "needs_clarification"]).default("pending").notNull(),
  clarificationNote: text("clarificationNote"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [
  uniqueIndex("documents_id_company_unique").on(table.id, table.companyId),
  foreignKey({
    columns: [table.companyId, table.uploadedBy],
    foreignColumns: [companyMembers.companyId, companyMembers.userId],
    name: "documents_uploader_membership_fk",
  }).onDelete("restrict"),
]);

export type Document = typeof documents.$inferSelect;
export type InsertDocument = typeof documents.$inferInsert;

// ─── Transactions (from bank/credit card statements + manual) ───────
export const transactions = mysqlTable("transactions", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("companyId").notNull().references(() => companies.id, { onDelete: "restrict" }),
  documentId: int("documentId"),
  date: timestamp("date").notNull(),
  description: text("description").notNull(),
  amount: decimal("amount", { precision: 15, scale: 2 }).notNull(),
  transactionType: mysqlEnum("transactionType", ["debit", "credit"]).notNull(),
  category: varchar("category", { length: 255 }),
  accountId: int("accountId"),
  autoCategory: varchar("autoCategory", { length: 255 }),
  autoCategoryConfidence: decimal("autoCategoryConfidence", { precision: 5, scale: 2 }),
  manualOverride: boolean("manualOverride").default(false).notNull(),
  notes: text("notes"),
  reference: varchar("reference", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [
  uniqueIndex("transactions_id_company_unique").on(table.id, table.companyId),
  foreignKey({
    columns: [table.documentId, table.companyId],
    foreignColumns: [documents.id, documents.companyId],
    name: "transactions_document_company_fk",
  }).onDelete("restrict"),
  foreignKey({
    columns: [table.accountId, table.companyId],
    foreignColumns: [chartOfAccounts.id, chartOfAccounts.companyId],
    name: "transactions_account_company_fk",
  }).onDelete("restrict"),
]);

export type Transaction = typeof transactions.$inferSelect;
export type InsertTransaction = typeof transactions.$inferInsert;

// ─── Journal Entries ─────────────────────────────────────────────────
export const journalEntries = mysqlTable("journal_entries", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("companyId").notNull().references(() => companies.id, { onDelete: "restrict" }),
  transactionId: int("transactionId"),
  date: timestamp("date").notNull(),
  description: text("description"),
  accountId: int("accountId").notNull(),
  debit: decimal("debit", { precision: 15, scale: 2 }).default("0").notNull(),
  credit: decimal("credit", { precision: 15, scale: 2 }).default("0").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [
  foreignKey({
    columns: [table.transactionId, table.companyId],
    foreignColumns: [transactions.id, transactions.companyId],
    name: "journal_entries_transaction_company_fk",
  }).onDelete("restrict"),
  foreignKey({
    columns: [table.accountId, table.companyId],
    foreignColumns: [chartOfAccounts.id, chartOfAccounts.companyId],
    name: "journal_entries_account_company_fk",
  }).onDelete("restrict"),
]);

export type JournalEntry = typeof journalEntries.$inferSelect;

// ─── Income Statement Lines (manual input) ──────────────────────────
export const incomeStatementLines = mysqlTable("income_statement_lines", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("companyId").notNull().references(() => companies.id, { onDelete: "restrict" }),
  documentId: int("documentId"),
  period: varchar("period", { length: 20 }).notNull(), // e.g. "2025-01" or "2025-Q1"
  lineType: mysqlEnum("lineType", ["revenue", "cost_of_goods", "operating_expense", "other_income", "other_expense", "tax"]).notNull(),
  description: varchar("description", { length: 500 }).notNull(),
  amount: decimal("amount", { precision: 15, scale: 2 }).notNull(),
  accountId: int("accountId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [
  foreignKey({
    columns: [table.documentId, table.companyId],
    foreignColumns: [documents.id, documents.companyId],
    name: "income_statement_lines_document_company_fk",
  }).onDelete("restrict"),
  foreignKey({
    columns: [table.accountId, table.companyId],
    foreignColumns: [chartOfAccounts.id, chartOfAccounts.companyId],
    name: "income_statement_lines_account_company_fk",
  }).onDelete("restrict"),
]);

export type IncomeStatementLine = typeof incomeStatementLines.$inferSelect;

// ─── Financial Snapshots (generated statements) ─────────────────────
export const financialSnapshots = mysqlTable("financial_snapshots", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("companyId").notNull().references(() => companies.id, { onDelete: "restrict" }),
  statementType: mysqlEnum("statementType", ["profit_loss", "balance_sheet", "cash_flow"]).notNull(),
  period: varchar("period", { length: 20 }).notNull(),
  data: json("data").notNull(), // full statement JSON
  generatedBy: int("generatedBy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [
  foreignKey({
    columns: [table.companyId, table.generatedBy],
    foreignColumns: [companyMembers.companyId, companyMembers.userId],
    name: "financial_snapshots_generator_membership_fk",
  }).onDelete("restrict"),
]);

export type FinancialSnapshot = typeof financialSnapshots.$inferSelect;

// ─── AI Advisor Conversations ────────────────────────────────────────
export const advisorConversations = mysqlTable("advisor_conversations", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("companyId").notNull(),
  userId: int("userId").notNull(),
  advisorType: mysqlEnum("advisorType", [
    "bookkeeper", "accountant", "tax_agent", "auditor", "cfo"
  ]).notNull(),
  title: varchar("title", { length: 255 }),
  messages: json("messages").notNull(), // Array of {role, content, timestamp}
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [
  foreignKey({
    columns: [table.companyId, table.userId],
    foreignColumns: [companyMembers.companyId, companyMembers.userId],
    name: "advisor_conversations_owner_membership_fk",
  }).onDelete("cascade"),
]);

export type AdvisorConversation = typeof advisorConversations.$inferSelect;
export type InsertAdvisorConversation = typeof advisorConversations.$inferInsert;

// ─── Admin Audit Logs ───────────────────────────────────────────────
export const auditLogs = mysqlTable("audit_logs", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").references(() => users.id, { onDelete: "set null" }),
  companyId: int("companyId").references(() => companies.id, { onDelete: "set null" }),
  action: varchar("action", { length: 100 }).notNull(), // e.g. "document_upload", "transaction_delete", "user_created"
  resourceType: varchar("resourceType", { length: 50 }).notNull(), // e.g. "document", "transaction", "user", "company"
  resourceId: int("resourceId"),
  details: json("details"), // Additional context about the action
  ipAddress: varchar("ipAddress", { length: 45 }),
  userAgent: text("userAgent"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AuditLog = typeof auditLogs.$inferSelect;
export type InsertAuditLog = typeof auditLogs.$inferInsert;

// ─── System Metrics ─────────────────────────────────────────────────
export const systemMetrics = mysqlTable("system_metrics", {
  id: int("id").autoincrement().primaryKey(),
  metricType: varchar("metricType", { length: 100 }).notNull(), // e.g. "document_processed", "llm_call", "transaction_created"
  value: decimal("value", { precision: 15, scale: 2 }).notNull(),
  unit: varchar("unit", { length: 50 }), // e.g. "ms", "count", "tokens"
  metadata: json("metadata"), // Additional context
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type SystemMetric = typeof systemMetrics.$inferSelect;
export type InsertSystemMetric = typeof systemMetrics.$inferInsert;
