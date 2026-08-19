CREATE TABLE `advisor_name_overrides` (
	`id` int AUTO_INCREMENT NOT NULL,
	`companyId` int NOT NULL,
	`advisorType` enum('bookkeeper','accountant','tax_agent','auditor','cfo') NOT NULL,
	`name` varchar(40) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `advisor_name_overrides_id` PRIMARY KEY(`id`),
	CONSTRAINT `advisor_name_overrides_company_advisor` UNIQUE(`companyId`,`advisorType`)
);
