import { relations } from "drizzle-orm";
import {
  advisorConversations,
  auditLogs,
  chartOfAccounts,
  companies,
  companyMembers,
  documents,
  financialSnapshots,
  incomeStatementLines,
  journalEntries,
  transactions,
  users,
} from "./schema";

export const usersRelations = relations(users, ({ many }) => ({
  createdCompanies: many(companies),
  companyMemberships: many(companyMembers),
  uploadedDocuments: many(documents),
  generatedFinancialSnapshots: many(financialSnapshots),
  advisorConversations: many(advisorConversations),
  auditLogs: many(auditLogs),
}));

export const companiesRelations = relations(companies, ({ one, many }) => ({
  creator: one(users, {
    fields: [companies.createdBy],
    references: [users.id],
  }),
  members: many(companyMembers),
  chartOfAccounts: many(chartOfAccounts),
  documents: many(documents),
  transactions: many(transactions),
  journalEntries: many(journalEntries),
  incomeStatementLines: many(incomeStatementLines),
  financialSnapshots: many(financialSnapshots),
  advisorConversations: many(advisorConversations),
  auditLogs: many(auditLogs),
}));

export const companyMembersRelations = relations(companyMembers, ({ one }) => ({
  company: one(companies, {
    fields: [companyMembers.companyId],
    references: [companies.id],
  }),
  user: one(users, {
    fields: [companyMembers.userId],
    references: [users.id],
  }),
}));

export const chartOfAccountsRelations = relations(
  chartOfAccounts,
  ({ one, many }) => ({
    company: one(companies, {
      fields: [chartOfAccounts.companyId],
      references: [companies.id],
    }),
    parent: one(chartOfAccounts, {
      fields: [chartOfAccounts.parentId],
      references: [chartOfAccounts.id],
      relationName: "accountHierarchy",
    }),
    children: many(chartOfAccounts, { relationName: "accountHierarchy" }),
    transactions: many(transactions),
    journalEntries: many(journalEntries),
    incomeStatementLines: many(incomeStatementLines),
  })
);

export const documentsRelations = relations(documents, ({ one, many }) => ({
  company: one(companies, {
    fields: [documents.companyId],
    references: [companies.id],
  }),
  uploader: one(users, {
    fields: [documents.uploadedBy],
    references: [users.id],
  }),
  transactions: many(transactions),
  incomeStatementLines: many(incomeStatementLines),
}));

export const transactionsRelations = relations(
  transactions,
  ({ one, many }) => ({
    company: one(companies, {
      fields: [transactions.companyId],
      references: [companies.id],
    }),
    document: one(documents, {
      fields: [transactions.documentId],
      references: [documents.id],
    }),
    account: one(chartOfAccounts, {
      fields: [transactions.accountId],
      references: [chartOfAccounts.id],
    }),
    journalEntries: many(journalEntries),
  })
);

export const journalEntriesRelations = relations(journalEntries, ({ one }) => ({
  company: one(companies, {
    fields: [journalEntries.companyId],
    references: [companies.id],
  }),
  transaction: one(transactions, {
    fields: [journalEntries.transactionId],
    references: [transactions.id],
  }),
  account: one(chartOfAccounts, {
    fields: [journalEntries.accountId],
    references: [chartOfAccounts.id],
  }),
}));

export const incomeStatementLinesRelations = relations(
  incomeStatementLines,
  ({ one }) => ({
    company: one(companies, {
      fields: [incomeStatementLines.companyId],
      references: [companies.id],
    }),
    document: one(documents, {
      fields: [incomeStatementLines.documentId],
      references: [documents.id],
    }),
    account: one(chartOfAccounts, {
      fields: [incomeStatementLines.accountId],
      references: [chartOfAccounts.id],
    }),
  })
);

export const financialSnapshotsRelations = relations(
  financialSnapshots,
  ({ one }) => ({
    company: one(companies, {
      fields: [financialSnapshots.companyId],
      references: [companies.id],
    }),
    generator: one(users, {
      fields: [financialSnapshots.generatedBy],
      references: [users.id],
    }),
  })
);

export const advisorConversationsRelations = relations(
  advisorConversations,
  ({ one }) => ({
    company: one(companies, {
      fields: [advisorConversations.companyId],
      references: [companies.id],
    }),
    user: one(users, {
      fields: [advisorConversations.userId],
      references: [users.id],
    }),
  })
);

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  user: one(users, {
    fields: [auditLogs.userId],
    references: [users.id],
  }),
  company: one(companies, {
    fields: [auditLogs.companyId],
    references: [companies.id],
  }),
}));
