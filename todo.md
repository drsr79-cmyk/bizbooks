# BizBooks - Project TODO

## Onboarding & User Management
- [x] User profile setup (name, IC number, designation: owner/staff)
- [x] Company registration (type, SSM number, tax number, owner details)
- [x] Multi-company support (owner sees all companies, staff sees permitted ones)
- [x] Role-based access control (owner vs staff permissions)
- [x] Staff invitation and company assignment

## Document Management
- [x] Receipt upload with image capture and OCR extraction
- [x] Invoice upload with OCR extraction
- [x] Zoho integration placeholder for receipts/invoices
- [x] Bank statement upload with auto-categorization (LLM-powered)
- [x] Credit card statement upload with auto-categorization
- [x] Manual correction interface for auto-categorized transactions
- [x] Income statement upload or manual line-item input
- [x] Document clarification workflow (AI asks user when data unclear)

## Financial Statements
- [x] Chart of Accounts management
- [x] Journal entries from categorized transactions
- [x] Profit & Loss statement generation
- [x] Balance Sheet generation
- [x] Cash Flow statement generation
- [x] Financial period management (monthly/quarterly/yearly)

## AI Expert Advisors
- [x] Bookkeeper advisor (interactive, helps with daily entries)
- [x] Accountant advisor (reviews and validates entries)
- [x] Tax Agent advisor (Malaysian LHDN compliance, tax optimization)
- [x] Auditor advisor (on-demand auditing)
- [x] CFO advisor (proactive, optimization strategies for all 3 statements)
- [x] Distinct professional personalities for each advisor
- [x] Clarification workflow integration

## Dashboard & UI
- [x] Owner dashboard with all-company overview
- [x] Company-specific dashboard with financial summary
- [x] Sidebar navigation with company switcher
- [x] Mobile-responsive design
- [x] Clean professional financial software styling
- [x] Minimal friction document upload flows

## Infrastructure
- [x] Database schema for all entities
- [x] tRPC routers for all features
- [x] LLM integration for OCR and categorization
- [x] File upload to S3 storage
- [x] Vitest tests for critical paths

## Bug Fixes
- [x] Fix HTML nesting error on /companies page: <p> cannot contain nested <div>

## Role-Based Access Control
- [x] Backend: Guard income statement procedures - owner/admin only
- [x] Backend: Guard financial report procedures - owner/admin only
- [x] Backend: Ensure company data isolation - users only see data for companies they belong to
- [x] Frontend: Hide Income Statement and Financial Reports nav items for staff
- [x] Frontend: Add staff summary view showing their input totals (expenses, receipts, invoices)
- [x] Frontend: Redirect staff away from restricted routes
- [x] Frontend: Company owners cannot see other company's income/reports
