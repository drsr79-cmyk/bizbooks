-- MySQL DDL auto-commits. For a partial migration, inspect information_schema
-- first and execute only the lines for constraints/indexes that are present.
-- The order below is the reverse of 0006_add_relational_integrity.sql.

ALTER TABLE `transactions` DROP FOREIGN KEY `transactions_account_company_fk`;
ALTER TABLE `transactions` DROP FOREIGN KEY `transactions_document_company_fk`;
ALTER TABLE `transactions` DROP FOREIGN KEY `transactions_companyId_companies_id_fk`;
ALTER TABLE `journal_entries` DROP FOREIGN KEY `journal_entries_account_company_fk`;
ALTER TABLE `journal_entries` DROP FOREIGN KEY `journal_entries_transaction_company_fk`;
ALTER TABLE `journal_entries` DROP FOREIGN KEY `journal_entries_companyId_companies_id_fk`;
ALTER TABLE `income_statement_lines` DROP FOREIGN KEY `income_statement_lines_account_company_fk`;
ALTER TABLE `income_statement_lines` DROP FOREIGN KEY `income_statement_lines_document_company_fk`;
ALTER TABLE `income_statement_lines` DROP FOREIGN KEY `income_statement_lines_companyId_companies_id_fk`;
ALTER TABLE `financial_snapshots` DROP FOREIGN KEY `financial_snapshots_generatedBy_users_id_fk`;
ALTER TABLE `financial_snapshots` DROP FOREIGN KEY `financial_snapshots_companyId_companies_id_fk`;
ALTER TABLE `documents` DROP FOREIGN KEY `documents_uploadedBy_users_id_fk`;
ALTER TABLE `documents` DROP FOREIGN KEY `documents_companyId_companies_id_fk`;
ALTER TABLE `company_members` DROP FOREIGN KEY `company_members_userId_users_id_fk`;
ALTER TABLE `company_members` DROP FOREIGN KEY `company_members_companyId_companies_id_fk`;
ALTER TABLE `companies` DROP FOREIGN KEY `companies_createdBy_users_id_fk`;
ALTER TABLE `chart_of_accounts` DROP FOREIGN KEY `chart_of_accounts_parent_company_fk`;
ALTER TABLE `chart_of_accounts` DROP FOREIGN KEY `chart_of_accounts_companyId_companies_id_fk`;
ALTER TABLE `audit_logs` DROP FOREIGN KEY `audit_logs_companyId_companies_id_fk`;
ALTER TABLE `audit_logs` DROP FOREIGN KEY `audit_logs_userId_users_id_fk`;
ALTER TABLE `advisor_conversations` DROP FOREIGN KEY `advisor_conversations_owner_membership_fk`;
ALTER TABLE `transactions` DROP INDEX `transactions_id_company_unique`;
ALTER TABLE `documents` DROP INDEX `documents_id_company_unique`;
ALTER TABLE `company_members` DROP INDEX `company_members_company_user_unique`;
ALTER TABLE `chart_of_accounts` DROP INDEX `chart_of_accounts_id_company_unique`;
