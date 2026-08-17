import { describe, expect, it } from "vitest";
import { getTableConfig, type MySqlTable } from "drizzle-orm/mysql-core";
import {
  createTableRelationsHelpers,
  extractTablesRelationalConfig,
} from "drizzle-orm/relations";
import * as schema from "../drizzle/schema";
import * as relationGraph from "../drizzle/relations";

type Constraint = {
  columns: string[];
  foreignColumns: string[];
  onDelete: string;
};

const constrainedTables: MySqlTable[] = [
  schema.advisorConversations,
  schema.auditLogs,
  schema.chartOfAccounts,
  schema.companies,
  schema.companyMembers,
  schema.documents,
  schema.financialSnapshots,
  schema.incomeStatementLines,
  schema.journalEntries,
  schema.transactions,
];

function constraints(): Record<string, Constraint> {
  return Object.fromEntries(
    constrainedTables.flatMap(table =>
      getTableConfig(table).foreignKeys.map(foreignKey => {
        const reference = foreignKey.reference();
        return [
          foreignKey.getName(),
          {
            columns: reference.columns.map(column => column.name),
            foreignColumns: reference.foreignColumns.map(column => column.name),
            onDelete: foreignKey.onDelete!,
          },
        ];
      })
    )
  );
}

describe("relational schema integrity", () => {
  it("defines every FK with the intended tenant scope and delete policy", () => {
    expect(constraints()).toEqual({
      advisor_conversations_owner_membership_fk: {
        columns: ["companyId", "userId"],
        foreignColumns: ["companyId", "userId"],
        onDelete: "cascade",
      },
      audit_logs_userId_users_id_fk: {
        columns: ["userId"],
        foreignColumns: ["id"],
        onDelete: "set null",
      },
      audit_logs_companyId_companies_id_fk: {
        columns: ["companyId"],
        foreignColumns: ["id"],
        onDelete: "set null",
      },
      chart_of_accounts_companyId_companies_id_fk: {
        columns: ["companyId"],
        foreignColumns: ["id"],
        onDelete: "restrict",
      },
      chart_of_accounts_parent_company_fk: {
        columns: ["parentId", "companyId"],
        foreignColumns: ["id", "companyId"],
        onDelete: "restrict",
      },
      companies_createdBy_users_id_fk: {
        columns: ["createdBy"],
        foreignColumns: ["id"],
        onDelete: "restrict",
      },
      company_members_companyId_companies_id_fk: {
        columns: ["companyId"],
        foreignColumns: ["id"],
        onDelete: "cascade",
      },
      company_members_userId_users_id_fk: {
        columns: ["userId"],
        foreignColumns: ["id"],
        onDelete: "cascade",
      },
      documents_companyId_companies_id_fk: {
        columns: ["companyId"],
        foreignColumns: ["id"],
        onDelete: "restrict",
      },
      documents_uploader_membership_fk: {
        columns: ["companyId", "uploadedBy"],
        foreignColumns: ["companyId", "userId"],
        onDelete: "restrict",
      },
      financial_snapshots_companyId_companies_id_fk: {
        columns: ["companyId"],
        foreignColumns: ["id"],
        onDelete: "restrict",
      },
      financial_snapshots_generator_membership_fk: {
        columns: ["companyId", "generatedBy"],
        foreignColumns: ["companyId", "userId"],
        onDelete: "restrict",
      },
      income_statement_lines_companyId_companies_id_fk: {
        columns: ["companyId"],
        foreignColumns: ["id"],
        onDelete: "restrict",
      },
      income_statement_lines_document_company_fk: {
        columns: ["documentId", "companyId"],
        foreignColumns: ["id", "companyId"],
        onDelete: "restrict",
      },
      income_statement_lines_account_company_fk: {
        columns: ["accountId", "companyId"],
        foreignColumns: ["id", "companyId"],
        onDelete: "restrict",
      },
      journal_entries_companyId_companies_id_fk: {
        columns: ["companyId"],
        foreignColumns: ["id"],
        onDelete: "restrict",
      },
      journal_entries_transaction_company_fk: {
        columns: ["transactionId", "companyId"],
        foreignColumns: ["id", "companyId"],
        onDelete: "restrict",
      },
      journal_entries_account_company_fk: {
        columns: ["accountId", "companyId"],
        foreignColumns: ["id", "companyId"],
        onDelete: "restrict",
      },
      transactions_companyId_companies_id_fk: {
        columns: ["companyId"],
        foreignColumns: ["id"],
        onDelete: "restrict",
      },
      transactions_document_company_fk: {
        columns: ["documentId", "companyId"],
        foreignColumns: ["id", "companyId"],
        onDelete: "restrict",
      },
      transactions_account_company_fk: {
        columns: ["accountId", "companyId"],
        foreignColumns: ["id", "companyId"],
        onDelete: "restrict",
      },
    });
  });

  it("defines the membership and composite parent unique indexes", () => {
    const indexes = [
      schema.chartOfAccounts,
      schema.companyMembers,
      schema.documents,
      schema.transactions,
    ].flatMap(table =>
      getTableConfig(table)
        .indexes.filter(index => index.config.unique)
        .map(index => [
          index.config.name,
          index.config.columns.map((column: any) => column.name),
        ])
    );

    expect(Object.fromEntries(indexes)).toEqual({
      chart_of_accounts_id_company_unique: ["id", "companyId"],
      company_members_company_user_unique: ["companyId", "userId"],
      documents_id_company_unique: ["id", "companyId"],
      transactions_id_company_unique: ["id", "companyId"],
    });
  });

  it.each([
    [
      "chartOfAccounts",
      "parent",
      ["parentId", "companyId"],
      ["id", "companyId"],
    ],
    [
      "documents",
      "uploaderMembership",
      ["companyId", "uploadedBy"],
      ["companyId", "userId"],
    ],
    [
      "transactions",
      "document",
      ["documentId", "companyId"],
      ["id", "companyId"],
    ],
    [
      "transactions",
      "account",
      ["accountId", "companyId"],
      ["id", "companyId"],
    ],
    [
      "journalEntries",
      "transaction",
      ["transactionId", "companyId"],
      ["id", "companyId"],
    ],
    [
      "journalEntries",
      "account",
      ["accountId", "companyId"],
      ["id", "companyId"],
    ],
    [
      "incomeStatementLines",
      "document",
      ["documentId", "companyId"],
      ["id", "companyId"],
    ],
    [
      "incomeStatementLines",
      "account",
      ["accountId", "companyId"],
      ["id", "companyId"],
    ],
    [
      "financialSnapshots",
      "generatorMembership",
      ["companyId", "generatedBy"],
      ["companyId", "userId"],
    ],
    [
      "advisorConversations",
      "ownerMembership",
      ["companyId", "userId"],
      ["companyId", "userId"],
    ],
  ] as const)(
    "maps %s.%s through the tenant key",
    (tableName, relationName, expectedFields, expectedReferences) => {
      const relationalConfig = extractTablesRelationalConfig(
        { ...schema, ...relationGraph },
        createTableRelationsHelpers
      );
      const relation = relationalConfig.tables[tableName]!.relations[
        relationName
      ] as any;

      expect(relation.config.fields.map((column: any) => column.name)).toEqual(
        expectedFields
      );
      expect(
        relation.config.references.map((column: any) => column.name)
      ).toEqual(expectedReferences);
    }
  );
});
