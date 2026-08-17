import { describe, expect, it } from "vitest";
import { getTableConfig, type MySqlTable } from "drizzle-orm/mysql-core";
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
} from "../drizzle/schema";
import * as relationGraph from "../drizzle/relations";

type DeleteAction = "cascade" | "restrict" | "set null";

function deleteActions(table: MySqlTable): Record<string, DeleteAction> {
  return Object.fromEntries(
    getTableConfig(table).foreignKeys.map(foreignKey => {
      const reference = foreignKey.reference();
      return [reference.columns[0]!.name, foreignKey.onDelete as DeleteAction];
    })
  );
}

describe("relational schema integrity", () => {
  it.each([
    [companies, { createdBy: "restrict" }],
    [companyMembers, { companyId: "cascade", userId: "cascade" }],
    [chartOfAccounts, { companyId: "restrict", parentId: "set null" }],
    [documents, { companyId: "restrict", uploadedBy: "restrict" }],
    [
      transactions,
      { companyId: "restrict", documentId: "set null", accountId: "set null" },
    ],
    [
      journalEntries,
      {
        companyId: "restrict",
        transactionId: "restrict",
        accountId: "restrict",
      },
    ],
    [
      incomeStatementLines,
      { companyId: "restrict", documentId: "set null", accountId: "set null" },
    ],
    [financialSnapshots, { companyId: "restrict", generatedBy: "restrict" }],
    [advisorConversations, { companyId: "cascade", userId: "cascade" }],
    [auditLogs, { userId: "set null", companyId: "set null" }],
  ] as const)(
    "defines the intended delete policy for %s",
    (table, expected) => {
      expect(deleteActions(table)).toEqual(expected);
    }
  );

  it("prevents duplicate company memberships", () => {
    const uniqueIndexes = getTableConfig(companyMembers).indexes.filter(
      index => index.config.unique
    );

    expect(uniqueIndexes).toHaveLength(1);
    expect(uniqueIndexes[0]?.config.name).toBe(
      "company_members_company_user_unique"
    );
    expect(
      uniqueIndexes[0]?.config.columns.map((column: any) => column.name)
    ).toEqual(["companyId", "userId"]);
  });

  it("exports relations for every table participating in the graph", () => {
    expect(Object.keys(relationGraph).sort()).toEqual(
      [
        "advisorConversationsRelations",
        "auditLogsRelations",
        "chartOfAccountsRelations",
        "companiesRelations",
        "companyMembersRelations",
        "documentsRelations",
        "financialSnapshotsRelations",
        "incomeStatementLinesRelations",
        "journalEntriesRelations",
        "transactionsRelations",
        "usersRelations",
      ].sort()
    );
  });
});
