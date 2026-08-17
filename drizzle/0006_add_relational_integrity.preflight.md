# Migration 0006 pre-flight

Migration `0006_add_relational_integrity.sql` is intentionally additive: it
does not delete orphaned data or choose which duplicate membership to keep.
Run the checks below against the target database and resolve every non-zero
result before applying the migration.

This migration was generated on a parallel branch from `main`. Its exact
snapshot `prevId` and journal position must be regenerated at merge time after
the final ordering of the other schema PRs is known. The `0006` filename only
reserves an unclaimed number; it does not pretend the eventual migration graph
can be known from this branch in isolation.

Take a backup first. Adding the unique constraint will fail while duplicate
`(companyId, userId)` pairs exist:

```sql
SELECT companyId, userId, COUNT(*) AS duplicateCount
FROM company_members
GROUP BY companyId, userId
HAVING COUNT(*) > 1;
```

Every count below must be zero before MySQL can add the foreign keys:

```sql
SELECT 'companies.createdBy' AS relationship, COUNT(*) AS orphanCount
FROM companies child LEFT JOIN users parent ON parent.id = child.createdBy
WHERE parent.id IS NULL
UNION ALL
SELECT 'company_members.companyId', COUNT(*)
FROM company_members child LEFT JOIN companies parent ON parent.id = child.companyId
WHERE parent.id IS NULL
UNION ALL
SELECT 'company_members.userId', COUNT(*)
FROM company_members child LEFT JOIN users parent ON parent.id = child.userId
WHERE parent.id IS NULL
UNION ALL
SELECT 'chart_of_accounts.companyId', COUNT(*)
FROM chart_of_accounts child LEFT JOIN companies parent ON parent.id = child.companyId
WHERE parent.id IS NULL
UNION ALL
SELECT 'chart_of_accounts.parentId', COUNT(*)
FROM chart_of_accounts child LEFT JOIN chart_of_accounts parent
  ON parent.id = child.parentId AND parent.companyId = child.companyId
WHERE child.parentId IS NOT NULL AND parent.id IS NULL
UNION ALL
SELECT 'documents.companyId', COUNT(*)
FROM documents child LEFT JOIN companies parent ON parent.id = child.companyId
WHERE parent.id IS NULL
UNION ALL
SELECT 'documents.uploadedBy', COUNT(*)
FROM documents child LEFT JOIN users parent ON parent.id = child.uploadedBy
WHERE parent.id IS NULL
UNION ALL
SELECT 'transactions.companyId', COUNT(*)
FROM transactions child LEFT JOIN companies parent ON parent.id = child.companyId
WHERE parent.id IS NULL
UNION ALL
SELECT 'transactions.documentId', COUNT(*)
FROM transactions child LEFT JOIN documents parent
  ON parent.id = child.documentId AND parent.companyId = child.companyId
WHERE child.documentId IS NOT NULL AND parent.id IS NULL
UNION ALL
SELECT 'transactions.accountId', COUNT(*)
FROM transactions child LEFT JOIN chart_of_accounts parent
  ON parent.id = child.accountId AND parent.companyId = child.companyId
WHERE child.accountId IS NOT NULL AND parent.id IS NULL
UNION ALL
SELECT 'journal_entries.companyId', COUNT(*)
FROM journal_entries child LEFT JOIN companies parent ON parent.id = child.companyId
WHERE parent.id IS NULL
UNION ALL
SELECT 'journal_entries.transactionId', COUNT(*)
FROM journal_entries child LEFT JOIN transactions parent
  ON parent.id = child.transactionId AND parent.companyId = child.companyId
WHERE child.transactionId IS NOT NULL AND parent.id IS NULL
UNION ALL
SELECT 'journal_entries.accountId', COUNT(*)
FROM journal_entries child LEFT JOIN chart_of_accounts parent
  ON parent.id = child.accountId AND parent.companyId = child.companyId
WHERE parent.id IS NULL
UNION ALL
SELECT 'income_statement_lines.companyId', COUNT(*)
FROM income_statement_lines child LEFT JOIN companies parent ON parent.id = child.companyId
WHERE parent.id IS NULL
UNION ALL
SELECT 'income_statement_lines.documentId', COUNT(*)
FROM income_statement_lines child LEFT JOIN documents parent
  ON parent.id = child.documentId AND parent.companyId = child.companyId
WHERE child.documentId IS NOT NULL AND parent.id IS NULL
UNION ALL
SELECT 'income_statement_lines.accountId', COUNT(*)
FROM income_statement_lines child LEFT JOIN chart_of_accounts parent
  ON parent.id = child.accountId AND parent.companyId = child.companyId
WHERE child.accountId IS NOT NULL AND parent.id IS NULL
UNION ALL
SELECT 'financial_snapshots.companyId', COUNT(*)
FROM financial_snapshots child LEFT JOIN companies parent ON parent.id = child.companyId
WHERE parent.id IS NULL
UNION ALL
SELECT 'financial_snapshots.generatedBy', COUNT(*)
FROM financial_snapshots child LEFT JOIN users parent ON parent.id = child.generatedBy
WHERE parent.id IS NULL
UNION ALL
SELECT 'advisor_conversations.ownerMembership', COUNT(*)
FROM advisor_conversations child LEFT JOIN company_members parent
  ON parent.companyId = child.companyId AND parent.userId = child.userId
WHERE parent.userId IS NULL
UNION ALL
SELECT 'audit_logs.companyId', COUNT(*)
FROM audit_logs child LEFT JOIN companies parent ON parent.id = child.companyId
WHERE child.companyId IS NOT NULL AND parent.id IS NULL
UNION ALL
SELECT 'audit_logs.userId', COUNT(*)
FROM audit_logs child LEFT JOIN users parent ON parent.id = child.userId
WHERE child.userId IS NOT NULL AND parent.id IS NULL;
```

Choose remediation with the data owner. Do not blindly delete accounting or
audit rows. Optional broken provenance links may be set to `NULL`; required
financial ownership links need a verified parent or an explicit archival plan.

## Partial-failure recovery

MySQL auto-commits each `ALTER TABLE`. If this migration stops part-way through,
do not immediately rerun it. First inspect which constraints and indexes exist:

```sql
SELECT tc.TABLE_NAME, tc.CONSTRAINT_NAME, tc.CONSTRAINT_TYPE,
       rc.DELETE_RULE, rc.UPDATE_RULE
FROM information_schema.TABLE_CONSTRAINTS tc
LEFT JOIN information_schema.REFERENTIAL_CONSTRAINTS rc
  ON rc.CONSTRAINT_SCHEMA = tc.CONSTRAINT_SCHEMA
 AND rc.CONSTRAINT_NAME = tc.CONSTRAINT_NAME
WHERE tc.CONSTRAINT_SCHEMA = DATABASE()
  AND tc.CONSTRAINT_NAME IN (
    'chart_of_accounts_id_company_unique',
    'company_members_company_user_unique',
    'documents_id_company_unique',
    'transactions_id_company_unique',
    'advisor_conversations_owner_membership_fk',
    'audit_logs_userId_users_id_fk',
    'audit_logs_companyId_companies_id_fk',
    'chart_of_accounts_companyId_companies_id_fk',
    'chart_of_accounts_parent_company_fk',
    'companies_createdBy_users_id_fk',
    'company_members_companyId_companies_id_fk',
    'company_members_userId_users_id_fk',
    'documents_companyId_companies_id_fk',
    'documents_uploadedBy_users_id_fk',
    'financial_snapshots_companyId_companies_id_fk',
    'financial_snapshots_generatedBy_users_id_fk',
    'income_statement_lines_companyId_companies_id_fk',
    'income_statement_lines_document_company_fk',
    'income_statement_lines_account_company_fk',
    'journal_entries_companyId_companies_id_fk',
    'journal_entries_transaction_company_fk',
    'journal_entries_account_company_fk',
    'transactions_companyId_companies_id_fk',
    'transactions_document_company_fk',
    'transactions_account_company_fk'
  )
ORDER BY tc.TABLE_NAME, tc.CONSTRAINT_NAME;

SELECT TABLE_NAME, INDEX_NAME,
       GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX) AS columnsInOrder
FROM information_schema.STATISTICS
WHERE TABLE_SCHEMA = DATABASE()
  AND INDEX_NAME IN (
    'chart_of_accounts_id_company_unique',
    'company_members_company_user_unique',
    'documents_id_company_unique',
    'transactions_id_company_unique'
  )
GROUP BY TABLE_NAME, INDEX_NAME;
```

Use `0006_add_relational_integrity.rollback.sql` as a reviewed reverse-order
rollback checklist. For a partial migration, execute only the `DROP` statements
whose constraint/index is present in the inspection results. Then re-run both
pre-flight queries and apply the migration from the beginning.

Finally inspect Drizzle's journal:

```sql
SELECT * FROM `__drizzle_migrations` ORDER BY `created_at` DESC;
```

Drizzle normally writes the journal row only after the complete SQL file
succeeds, so a partially applied migration should have no row. If an operator
manually registered this migration, remove only the row whose `hash` matches
the SHA-256 of the exact `0006_add_relational_integrity.sql` being rolled back;
the committed file hashes to
`b0792c3cf3f273da30cedea56a68dfce9a8f1d9cd8e50252594583ad46d4ded8`.
Verify the hash locally before using it in a `DELETE`;
never delete the latest journal row based on ordering alone. After rollback,
verify the constraints are absent and the matching journal row is absent before
retrying.
