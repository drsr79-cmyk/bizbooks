CREATE TABLE `advisor_conversations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`companyId` int NOT NULL,
	`userId` int NOT NULL,
	`advisorType` enum('bookkeeper','accountant','tax_agent','auditor','cfo') NOT NULL,
	`title` varchar(255),
	`messages` json NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `advisor_conversations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `chart_of_accounts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`companyId` int NOT NULL,
	`code` varchar(20) NOT NULL,
	`name` varchar(255) NOT NULL,
	`accountType` enum('asset','liability','equity','revenue','expense') NOT NULL,
	`subType` varchar(100),
	`parentId` int,
	`isDefault` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `chart_of_accounts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `companies` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`companyType` enum('enterprise','plt','sdn_bhd','bhd') NOT NULL,
	`ssmNumber` varchar(50) NOT NULL,
	`taxNumber` varchar(50),
	`ownerName` varchar(255),
	`ownerIc` varchar(20),
	`address` text,
	`financialYearEnd` varchar(5),
	`currency` varchar(3) NOT NULL DEFAULT 'MYR',
	`createdBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `companies_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `company_members` (
	`id` int AUTO_INCREMENT NOT NULL,
	`companyId` int NOT NULL,
	`userId` int NOT NULL,
	`memberRole` enum('owner','staff') NOT NULL,
	`permissions` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `company_members_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `documents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`companyId` int NOT NULL,
	`uploadedBy` int NOT NULL,
	`docType` enum('receipt','invoice','bank_statement','credit_card_statement','income_statement','other') NOT NULL,
	`fileName` varchar(500) NOT NULL,
	`fileUrl` text NOT NULL,
	`fileKey` varchar(500) NOT NULL,
	`mimeType` varchar(100),
	`ocrText` text,
	`ocrData` json,
	`status` enum('pending','processing','processed','error','needs_clarification') NOT NULL DEFAULT 'pending',
	`clarificationNote` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `documents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `financial_snapshots` (
	`id` int AUTO_INCREMENT NOT NULL,
	`companyId` int NOT NULL,
	`statementType` enum('profit_loss','balance_sheet','cash_flow') NOT NULL,
	`period` varchar(20) NOT NULL,
	`data` json NOT NULL,
	`generatedBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `financial_snapshots_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `income_statement_lines` (
	`id` int AUTO_INCREMENT NOT NULL,
	`companyId` int NOT NULL,
	`documentId` int,
	`period` varchar(20) NOT NULL,
	`lineType` enum('revenue','cost_of_goods','operating_expense','other_income','other_expense','tax') NOT NULL,
	`description` varchar(500) NOT NULL,
	`amount` decimal(15,2) NOT NULL,
	`accountId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `income_statement_lines_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `journal_entries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`companyId` int NOT NULL,
	`transactionId` int,
	`date` timestamp NOT NULL,
	`description` text,
	`accountId` int NOT NULL,
	`debit` decimal(15,2) NOT NULL DEFAULT '0',
	`credit` decimal(15,2) NOT NULL DEFAULT '0',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `journal_entries_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `transactions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`companyId` int NOT NULL,
	`documentId` int,
	`date` timestamp NOT NULL,
	`description` text NOT NULL,
	`amount` decimal(15,2) NOT NULL,
	`transactionType` enum('debit','credit') NOT NULL,
	`category` varchar(255),
	`accountId` int,
	`autoCategory` varchar(255),
	`autoCategoryConfidence` decimal(5,2),
	`manualOverride` boolean NOT NULL DEFAULT false,
	`notes` text,
	`reference` varchar(255),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `transactions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` ADD `icNumber` varchar(20);--> statement-breakpoint
ALTER TABLE `users` ADD `phone` varchar(20);--> statement-breakpoint
ALTER TABLE `users` ADD `onboarded` boolean DEFAULT false NOT NULL;