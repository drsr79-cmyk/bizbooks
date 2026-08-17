import { eq, and, desc, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";

import {
  InsertUser, users,
  companies, InsertCompany,
  companyMembers, InsertCompanyMember,
  chartOfAccounts,
  documents, InsertDocument,
  transactions, InsertTransaction,
  journalEntries,
  incomeStatementLines,
  financialSnapshots,
  advisorConversations, InsertAdvisorConversation,
  auditLogs, InsertAuditLog,
  systemMetrics, InsertSystemMetric,
} from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ─── User helpers ────────────────────────────────────────────────────
export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;

  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};

  const textFields = ["name", "email", "loginMethod"] as const;
  type TextField = (typeof textFields)[number];
  const assignNullable = (field: TextField) => {
    const value = user[field];
    if (value === undefined) return;
    const normalized = value ?? null;
    values[field] = normalized;
    updateSet[field] = normalized;
  };
  textFields.forEach(assignNullable);

  if (user.lastSignedIn !== undefined) { values.lastSignedIn = user.lastSignedIn; updateSet.lastSignedIn = user.lastSignedIn; }
  if (user.role !== undefined) { values.role = user.role; updateSet.role = user.role; }
  else if (user.openId === ENV.ownerOpenId) { values.role = 'admin'; updateSet.role = 'admin'; }

  if (!values.lastSignedIn) values.lastSignedIn = new Date();
  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();

  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function updateUserProfile(userId: number, data: { name?: string; icNumber?: string; phone?: string; onboarded?: boolean }) {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set(data).where(eq(users.id, userId));
}

// ─── Company helpers ─────────────────────────────────────────────────
export async function createCompany(data: InsertCompany) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(companies).values(data);
  return result[0].insertId;
}

export async function getCompanyById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(companies).where(eq(companies.id, id)).limit(1);
  return result[0];
}

export async function getUserCompanies(userId: number) {
  const db = await getDb();
  if (!db) return [];
  const memberships = await db.select().from(companyMembers).where(eq(companyMembers.userId, userId));
  if (memberships.length === 0) return [];
  const companyIds = memberships.map(m => m.companyId);
  const result = await db.select().from(companies).where(sql`${companies.id} IN (${sql.join(companyIds.map(id => sql`${id}`), sql`, `)})`);
  return result.map(c => {
    const membership = memberships.find(m => m.companyId === c.id);
    return { ...c, memberRole: membership?.memberRole ?? 'staff', accessLevel: membership?.accessLevel ?? 'full', permissions: membership?.permissions };
  });
}

export async function addCompanyMember(data: InsertCompanyMember) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.insert(companyMembers).values(data);
}

export async function getCompanyMembers(companyId: number) {
  const db = await getDb();
  if (!db) return [];
  const members = await db.select().from(companyMembers).where(eq(companyMembers.companyId, companyId));
  if (members.length === 0) return [];
  const userIds = members.map(m => m.userId);
  const userList = await db.select().from(users).where(sql`${users.id} IN (${sql.join(userIds.map(id => sql`${id}`), sql`, `)})`);
  return members.map(m => {
    const user = userList.find(u => u.id === m.userId);
    return { ...m, userName: user?.name, userEmail: user?.email };
  });
}

// ─── Chart of Accounts ──────────────────────────────────────────────
export async function getChartOfAccounts(companyId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(chartOfAccounts).where(eq(chartOfAccounts.companyId, companyId));
}

export async function seedDefaultAccounts(companyId: number) {
  const db = await getDb();
  if (!db) return;
  const defaults = [
    { code: "1000", name: "Cash & Bank", accountType: "asset" as const, subType: "current_asset" },
    { code: "1100", name: "Accounts Receivable", accountType: "asset" as const, subType: "current_asset" },
    { code: "1200", name: "Inventory", accountType: "asset" as const, subType: "current_asset" },
    { code: "1500", name: "Fixed Assets", accountType: "asset" as const, subType: "non_current_asset" },
    { code: "2000", name: "Accounts Payable", accountType: "liability" as const, subType: "current_liability" },
    { code: "2100", name: "Accrued Expenses", accountType: "liability" as const, subType: "current_liability" },
    { code: "2500", name: "Long-term Loans", accountType: "liability" as const, subType: "non_current_liability" },
    { code: "3000", name: "Share Capital", accountType: "equity" as const, subType: "equity" },
    { code: "3100", name: "Retained Earnings", accountType: "equity" as const, subType: "equity" },
    { code: "4000", name: "Sales Revenue", accountType: "revenue" as const, subType: "operating_revenue" },
    { code: "4100", name: "Service Revenue", accountType: "revenue" as const, subType: "operating_revenue" },
    { code: "4500", name: "Other Income", accountType: "revenue" as const, subType: "other_income" },
    { code: "5000", name: "Cost of Goods Sold", accountType: "expense" as const, subType: "cost_of_goods" },
    { code: "6000", name: "Salaries & Wages", accountType: "expense" as const, subType: "operating_expense" },
    { code: "6100", name: "Rent & Utilities", accountType: "expense" as const, subType: "operating_expense" },
    { code: "6200", name: "Office Supplies", accountType: "expense" as const, subType: "operating_expense" },
    { code: "6300", name: "Marketing & Advertising", accountType: "expense" as const, subType: "operating_expense" },
    { code: "6400", name: "Professional Fees", accountType: "expense" as const, subType: "operating_expense" },
    { code: "6500", name: "Depreciation", accountType: "expense" as const, subType: "operating_expense" },
    { code: "6600", name: "Insurance", accountType: "expense" as const, subType: "operating_expense" },
    { code: "6700", name: "Travel & Entertainment", accountType: "expense" as const, subType: "operating_expense" },
    { code: "6800", name: "Miscellaneous Expenses", accountType: "expense" as const, subType: "operating_expense" },
    { code: "7000", name: "Interest Expense", accountType: "expense" as const, subType: "other_expense" },
    { code: "8000", name: "Tax Expense", accountType: "expense" as const, subType: "tax" },
  ];
  await db.insert(chartOfAccounts).values(defaults.map(d => ({ ...d, companyId, isDefault: true })));
}

// ─── Documents ──────────────────────────────────────────────────────
export async function createDocument(data: InsertDocument) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(documents).values(data);
  return result[0].insertId;
}

export async function getDocuments(companyId: number, docType?: string) {
  const db = await getDb();
  if (!db) return [];
  if (docType) {
    return db.select().from(documents)
      .where(and(eq(documents.companyId, companyId), eq(documents.docType, docType as any)))
      .orderBy(desc(documents.createdAt));
  }
  return db.select().from(documents).where(eq(documents.companyId, companyId)).orderBy(desc(documents.createdAt));
}

export async function getDocumentById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(documents).where(eq(documents.id, id)).limit(1);
  return result[0];
}

export async function updateDocument(id: number, data: Partial<InsertDocument>) {
  const db = await getDb();
  if (!db) return;
  await db.update(documents).set(data).where(eq(documents.id, id));
}

// ─── Transactions ───────────────────────────────────────────────────
export async function createTransaction(data: InsertTransaction) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(transactions).values(data);
  return result[0].insertId;
}

export async function createTransactionsBatch(data: InsertTransaction[]) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  if (data.length === 0) return;
  await db.insert(transactions).values(data);
}

export async function getTransactions(companyId: number, limit = 100, offset = 0) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(transactions)
    .where(eq(transactions.companyId, companyId))
    .orderBy(desc(transactions.date))
    .limit(limit).offset(offset);
}

export async function getTransactionById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(transactions).where(eq(transactions.id, id)).limit(1);
  return result[0];
}

export async function updateTransaction(id: number, data: Partial<InsertTransaction>) {
  const db = await getDb();
  if (!db) return;
  await db.update(transactions).set(data).where(eq(transactions.id, id));
}

// ─── Income Statement Lines ─────────────────────────────────────────
export async function createIncomeStatementLine(data: any) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(incomeStatementLines).values(data);
  return result[0].insertId;
}

export async function getIncomeStatementLines(companyId: number, period?: string) {
  const db = await getDb();
  if (!db) return [];
  if (period) {
    return db.select().from(incomeStatementLines)
      .where(and(eq(incomeStatementLines.companyId, companyId), eq(incomeStatementLines.period, period)));
  }
  return db.select().from(incomeStatementLines).where(eq(incomeStatementLines.companyId, companyId));
}

export async function getIncomeStatementLineById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(incomeStatementLines)
    .where(eq(incomeStatementLines.id, id))
    .limit(1);
  return result[0];
}

export async function deleteIncomeStatementLine(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(incomeStatementLines).where(eq(incomeStatementLines.id, id));
}

// ─── Journal Entries ─────────────────────────────────────────────────
export async function createJournalEntries(entries: any[]) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  if (entries.length === 0) return;
  await db.insert(journalEntries).values(entries);
}

export async function getJournalEntries(companyId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(journalEntries).where(eq(journalEntries.companyId, companyId)).orderBy(desc(journalEntries.date));
}

// ─── Financial Snapshots ─────────────────────────────────────────────
export async function saveFinancialSnapshot(data: any) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(financialSnapshots).values(data);
  return result[0].insertId;
}

export async function getFinancialSnapshots(companyId: number, statementType?: string) {
  const db = await getDb();
  if (!db) return [];
  if (statementType) {
    return db.select().from(financialSnapshots)
      .where(and(eq(financialSnapshots.companyId, companyId), eq(financialSnapshots.statementType, statementType as any)))
      .orderBy(desc(financialSnapshots.createdAt));
  }
  return db.select().from(financialSnapshots).where(eq(financialSnapshots.companyId, companyId)).orderBy(desc(financialSnapshots.createdAt));
}

// ─── Advisor Conversations ──────────────────────────────────────────
export async function createConversation(data: InsertAdvisorConversation) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(advisorConversations).values(data);
  return result[0].insertId;
}

export async function getConversations(companyId: number, userId: number, advisorType?: string) {
  const db = await getDb();
  if (!db) return [];
  if (advisorType) {
    return db.select().from(advisorConversations)
      .where(and(
        eq(advisorConversations.companyId, companyId),
        eq(advisorConversations.userId, userId),
        eq(advisorConversations.advisorType, advisorType as any)
      ))
      .orderBy(desc(advisorConversations.updatedAt));
  }
  return db.select().from(advisorConversations)
    .where(and(eq(advisorConversations.companyId, companyId), eq(advisorConversations.userId, userId)))
    .orderBy(desc(advisorConversations.updatedAt));
}

export async function getConversationById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(advisorConversations).where(eq(advisorConversations.id, id)).limit(1);
  return result[0];
}

export async function updateConversation(id: number, data: { messages?: any; title?: string }) {
  const db = await getDb();
  if (!db) return;
  await db.update(advisorConversations).set(data).where(eq(advisorConversations.id, id));
}

// ─── Role-based access helpers ──────────────────────────────────────
export async function getMemberRole(companyId: number, userId: number): Promise<string | null> {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(companyMembers)
    .where(and(eq(companyMembers.companyId, companyId), eq(companyMembers.userId, userId)))
    .limit(1);
  return result[0]?.memberRole ?? null;
}

export async function getStaffInputSummary(companyId: number, userId: number) {
  const db = await getDb();
  if (!db) return { receipts: 0, invoices: 0, bankStatements: 0, totalExpenses: 0, totalIncome: 0, transactions: 0 };

  const userDocs = await db.select().from(documents)
    .where(and(eq(documents.companyId, companyId), eq(documents.uploadedBy, userId)));

  const receipts = userDocs.filter(d => d.docType === 'receipt').length;
  const invoices = userDocs.filter(d => d.docType === 'invoice').length;
  const bankStatements = userDocs.filter(d => d.docType === 'bank_statement' || d.docType === 'credit_card_statement').length;

  const txns = await db.select().from(transactions)
    .where(eq(transactions.companyId, companyId));

  const totalExpenses = txns.filter(t => t.transactionType === 'debit').reduce((sum, t) => sum + parseFloat(t.amount), 0);
  const totalIncome = txns.filter(t => t.transactionType === 'credit').reduce((sum, t) => sum + parseFloat(t.amount), 0);

  // Category breakdown
  const categoryBreakdown: Record<string, number> = {};
  txns.forEach(t => {
    const cat = t.category || 'Uncategorized';
    categoryBreakdown[cat] = (categoryBreakdown[cat] || 0) + parseFloat(t.amount);
  });

  return {
    receipts,
    invoices,
    bankStatements,
    totalExpenses,
    totalIncome,
    transactions: txns.length,
    categoryBreakdown,
  };
}


// ─── Member Management ─────────────────────────────────────────────
export async function getUserByEmail(email: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return result[0];
}

export async function getCompanyMemberById(memberId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(companyMembers)
    .where(eq(companyMembers.id, memberId))
    .limit(1);
  return result[0];
}

export async function updateCompanyMember(memberId: number, data: { memberRole?: string; accessLevel?: string; permissions?: string }) {
  const db = await getDb();
  if (!db) return;
  await db.update(companyMembers).set(data as any).where(eq(companyMembers.id, memberId));
}

export async function removeCompanyMember(memberId: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(companyMembers).where(eq(companyMembers.id, memberId));
}

export async function getMemberByCompanyAndUser(companyId: number, userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(companyMembers)
    .where(and(eq(companyMembers.companyId, companyId), eq(companyMembers.userId, userId)))
    .limit(1);
  return result[0];
}

// ─── Transaction Deletion ──────────────────────────────────────────
export async function deleteTransaction(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(transactions).where(eq(transactions.id, id));
}

export async function deleteTransactionsByDocumentId(documentId: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(transactions).where(eq(transactions.documentId, documentId));
}

// ─── Admin: Audit Logs ──────────────────────────────────────────────
export async function logAuditEvent(data: InsertAuditLog) {
  const db = await getDb();
  if (!db) return;
  await db.insert(auditLogs).values(data);
}

export async function getAuditLogs(limit = 1000, offset = 0) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(limit).offset(offset);
}

export async function getAuditLogsByCompany(companyId: number, limit = 500) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(auditLogs).where(eq(auditLogs.companyId, companyId)).orderBy(desc(auditLogs.createdAt)).limit(limit);
}

export async function getAuditLogsByUser(userId: number, limit = 500) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(auditLogs).where(eq(auditLogs.userId, userId)).orderBy(desc(auditLogs.createdAt)).limit(limit);
}

// ─── Admin: System Metrics ──────────────────────────────────────────
export async function recordSystemMetric(data: InsertSystemMetric) {
  const db = await getDb();
  if (!db) return;
  await db.insert(systemMetrics).values(data);
}

export async function getSystemMetrics(metricType?: string, limit = 1000) {
  const db = await getDb();
  if (!db) return [];
  if (metricType) {
    return db.select().from(systemMetrics).where(eq(systemMetrics.metricType, metricType)).orderBy(desc(systemMetrics.createdAt)).limit(limit);
  }
  return db.select().from(systemMetrics).orderBy(desc(systemMetrics.createdAt)).limit(limit);
}

// ─── Admin: Platform Statistics ─────────────────────────────────────
export async function getAdminStats() {
  const db = await getDb();
  if (!db) return null;

  const totalUsers = await db.select({ count: sql`COUNT(*)` }).from(users);
  const totalCompanies = await db.select({ count: sql`COUNT(*)` }).from(companies);
  const totalDocuments = await db.select({ count: sql`COUNT(*)` }).from(documents);
  const totalTransactions = await db.select({ count: sql`COUNT(*)` }).from(transactions);
  const totalAdvisorConversations = await db.select({ count: sql`COUNT(*)` }).from(advisorConversations);

  // Document status breakdown
  const docStatusBreakdown = await db.select({
    status: documents.status,
    count: sql`COUNT(*)`,
  }).from(documents).groupBy(documents.status);

  // Transaction type breakdown
  const txnTypeBreakdown = await db.select({
    type: transactions.transactionType,
    count: sql`COUNT(*)`,
    total: sql`SUM(${transactions.amount})`,
  }).from(transactions).groupBy(transactions.transactionType);

  return {
    totalUsers: (totalUsers[0]?.count as number) || 0,
    totalCompanies: (totalCompanies[0]?.count as number) || 0,
    totalDocuments: (totalDocuments[0]?.count as number) || 0,
    totalTransactions: (totalTransactions[0]?.count as number) || 0,
    totalAdvisorConversations: (totalAdvisorConversations[0]?.count as number) || 0,
    docStatusBreakdown: docStatusBreakdown || [],
    txnTypeBreakdown: txnTypeBreakdown || [],
  };
}

export async function getAllUsers(limit = 1000, offset = 0) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(users).orderBy(desc(users.createdAt)).limit(limit).offset(offset);
}

export async function getAllCompanies(limit = 1000, offset = 0) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(companies).orderBy(desc(companies.createdAt)).limit(limit).offset(offset);
}

export async function getAllTransactions(limit = 1000, offset = 0) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(transactions).orderBy(desc(transactions.date)).limit(limit).offset(offset);
}

export async function getDocumentProcessingStats() {
  const db = await getDb();
  if (!db) return null;

  const totalProcessed = await db.select({ count: sql`COUNT(*)` }).from(documents).where(eq(documents.status, 'processed'));
  const totalFailed = await db.select({ count: sql`COUNT(*)` }).from(documents).where(eq(documents.status, 'error'));
  const totalPending = await db.select({ count: sql`COUNT(*)` }).from(documents).where(eq(documents.status, 'pending'));
  const totalProcessing = await db.select({ count: sql`COUNT(*)` }).from(documents).where(eq(documents.status, 'processing'));
  const totalNeedsClarification = await db.select({ count: sql`COUNT(*)` }).from(documents).where(eq(documents.status, 'needs_clarification'));

  return {
    processed: (totalProcessed[0]?.count as number) || 0,
    failed: (totalFailed[0]?.count as number) || 0,
    pending: (totalPending[0]?.count as number) || 0,
    processing: (totalProcessing[0]?.count as number) || 0,
    needsClarification: (totalNeedsClarification[0]?.count as number) || 0,
  };
}
