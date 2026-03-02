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

## Member Access Management & Fixes
- [x] Backend: Add access_level column (limited/full) to companyMembers table
- [x] Backend: Add endpoint for owner to update member role (staff/owner) and access level (limited/full)
- [x] Backend: Add endpoint for owner to invite/add members to company
- [x] Backend: Add endpoint for owner to remove members from company
- [x] Backend: Enforce access_level checks - limited staff can only upload, full staff can also edit/delete
- [x] Frontend: Build member management UI in Companies page (list members, change role, change access)
- [x] Frontend: Add invite member dialog
- [x] Backend: Add transaction delete endpoint
- [x] Frontend: Add delete button on transactions with confirmation
- [x] Backend: Fix document upload auto-categorization - ensure LLM is called to categorize uploaded documents
- [x] Frontend: Show categorization status on uploaded documents

## Auto-Categorization Fix
- [x] Backend: Fix auto-categorization to trigger on ALL document uploads (not just images/PDFs)
- [x] Backend: For non-image files (CSV, Excel, text), parse content server-side and send to LLM
- [x] Backend: Integrate bookkeeper advisor to ask clarification questions when categorization is unclear
- [x] Frontend: Show real-time categorization progress on uploaded documents
- [x] Frontend: Show bookkeeper clarification questions inline on documents page
- [x] Frontend: Allow user to respond to bookkeeper questions and re-categorize

## Bug: Auto-categorization not working on Bank Statements upload
- [x] Diagnose why credit card statement upload on Bank Statements page does not trigger auto-categorization
- [x] Fix the root cause: LLM content parsing failed silently (thinking model returns array content, not string)
- [x] Created robust llmHelper.ts to handle all content formats
- [x] Added null ocrData handling - marks as error instead of silently setting processed with no data
- [x] Added Reprocess button for documents that show processed but have no data
- [x] Fixed processWithOCR to also handle bank/credit card statement transactions
- [x] Verify fix works end-to-end
