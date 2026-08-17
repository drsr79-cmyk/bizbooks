# Migration 0004 pre-flight

Migration `0004_add_relational_integrity.sql` is intentionally additive: it
does not delete orphaned data or choose which duplicate membership to keep.
Run the checks below against the target database and resolve every non-zero
result before applying the migration.

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
FROM chart_of_accounts child LEFT JOIN chart_of_accounts parent ON parent.id = child.parentId
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
FROM transactions child LEFT JOIN documents parent ON parent.id = child.documentId
WHERE child.documentId IS NOT NULL AND parent.id IS NULL
UNION ALL
SELECT 'transactions.accountId', COUNT(*)
FROM transactions child LEFT JOIN chart_of_accounts parent ON parent.id = child.accountId
WHERE child.accountId IS NOT NULL AND parent.id IS NULL
UNION ALL
SELECT 'journal_entries.companyId', COUNT(*)
FROM journal_entries child LEFT JOIN companies parent ON parent.id = child.companyId
WHERE parent.id IS NULL
UNION ALL
SELECT 'journal_entries.transactionId', COUNT(*)
FROM journal_entries child LEFT JOIN transactions parent ON parent.id = child.transactionId
WHERE child.transactionId IS NOT NULL AND parent.id IS NULL
UNION ALL
SELECT 'journal_entries.accountId', COUNT(*)
FROM journal_entries child LEFT JOIN chart_of_accounts parent ON parent.id = child.accountId
WHERE parent.id IS NULL
UNION ALL
SELECT 'income_statement_lines.companyId', COUNT(*)
FROM income_statement_lines child LEFT JOIN companies parent ON parent.id = child.companyId
WHERE parent.id IS NULL
UNION ALL
SELECT 'income_statement_lines.documentId', COUNT(*)
FROM income_statement_lines child LEFT JOIN documents parent ON parent.id = child.documentId
WHERE child.documentId IS NOT NULL AND parent.id IS NULL
UNION ALL
SELECT 'income_statement_lines.accountId', COUNT(*)
FROM income_statement_lines child LEFT JOIN chart_of_accounts parent ON parent.id = child.accountId
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
SELECT 'advisor_conversations.companyId', COUNT(*)
FROM advisor_conversations child LEFT JOIN companies parent ON parent.id = child.companyId
WHERE parent.id IS NULL
UNION ALL
SELECT 'advisor_conversations.userId', COUNT(*)
FROM advisor_conversations child LEFT JOIN users parent ON parent.id = child.userId
WHERE parent.id IS NULL
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

