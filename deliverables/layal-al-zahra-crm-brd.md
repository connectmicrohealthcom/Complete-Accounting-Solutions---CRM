# Layal Al Zahra Salon CRM
## Business Requirements Document (BRD) and Current-State Assessment

**Prepared:** 30 September 2026  
**Business:** Layal Al Zahra Salon, Dubai, UAE  
**Document purpose:** Describe the current CRM, identify the recent Client Groups and Finance additions, and define the work needed before the system can be treated as production-ready.

> **Status note:** This document is based on the source code available in the project and the recent implementation transcript. It distinguishes source-verified behavior from work reported in that transcript. It is not a claim that the application has passed end-to-end acceptance testing, financial reconciliation, or a security review.

## 1. Executive summary

Layal Al Zahra Salon CRM is a salon operations application intended to consolidate client records, appointments, services, staff, point of sale, inventory, loyalty, and financial tracking. The current workspace contains a React web application, an Express API, shared database and API packages, and setup/seed scripts.

The existing application already contains the principal salon-management areas. The recent implementation added client segmentation and a first version of Finance: automatic client groups, user-defined client segments, payment summaries, expense tracking, and three financial reports. The database schema additions for client groups and expenses were pushed in the development environment, and default expense categories were seeded, according to the implementation transcript.

The current work should be treated as a functional first version, not a finished accounting or production system. The salon frontend typecheck passes. The API-server typecheck currently fails with six TypeScript errors in the existing inventory, loyalty, and services routes: numeric request values are passed to Drizzle numeric columns that expect strings. No end-to-end acceptance suite or accounting reconciliation has been recorded. Several business rules and production controls therefore need validation and completion.

## 2. Business context and objectives

### 2.1 Business need

Salon operations span appointment scheduling, client history, staff performance, retail/product stock, payments, and recurring client relationships. Keeping these activities in separate tools or manual records can create duplicate entry, inconsistent client histories, and limited visibility into revenue and operating costs.

### 2.2 Objectives

The CRM is intended to:

1. Provide a shared operational view of clients, appointments, services, staff, sales, inventory, and loyalty activity.
2. Help the salon identify client follow-up opportunities using saved, data-driven segments.
3. Record sales and operating expenses in one system and make period-based summaries available to management.
4. Reduce avoidable manual reconciliation by making records searchable, filterable, and exportable.
5. Support day-to-day work in AED and the salon’s Dubai operating context.

These are product objectives, not measured outcomes; no baseline or improvement metrics have yet been supplied.

## 3. Stakeholders and users

| Stakeholder | Main needs |
|---|---|
| Salon owner / administrator | Business overview, financial visibility, staff and service configuration, access control |
| Salon manager | Appointment oversight, staff operations, inventory, client retention, expenses and reports |
| Receptionist | Client records, appointments, checkout and payment records |
| Stylist / therapist | Relevant appointment and client information, service history, tips and staff-related views |
| Finance / bookkeeper | Reliable, traceable sales and expense records, reconciled exports and reports |

The project documentation defines staff roles as admin, manager, receptionist, stylist, and therapist. The precise data and action permissions for each role still need a formally approved permission matrix.

## 4. Scope

### 4.1 In scope in the current product

- Login/session-based application entry and protected frontend routes.
- Salon dashboard, appointments, calendar, clients, services, staff, sales/POS, inventory, loyalty, settings, and staff-related financial views.
- Client groups and saved custom client segments.
- Payment summary and client payment history.
- Expense and expense-category management.
- Profit-and-loss, trial-balance-style, and balance-sheet-style summaries.
- CSV exports exposed by the new client-group and finance screens.

### 4.2 Not established as complete

- A formally validated general ledger or audited accounting system.
- Tax/VAT calculation, filing, or jurisdiction-specific compliance.
- Bank, card-terminal, accounting-software, messaging, or marketing integrations.
- Receipt image/file storage and automated receipt extraction.
- Payroll disbursement, statutory payroll calculations, or accounting-grade wage accruals.
- Automated backups, disaster recovery objectives, production monitoring, and approved retention policy.
- A complete role-permission matrix enforced by the API.

## 5. Current system and delivery status

### 5.1 Existing before the recent additions

The project documentation and routes identify the following existing product areas:

- **Dashboard:** salon summary, revenue chart, upcoming appointments, and top services.
- **Appointments and calendar:** appointment records, calendar and list views, status updates, and appointment summaries/analytics.
- **Clients:** searchable client records, create/edit flows, profiles, and client history covering appointments and sales. Client data includes contact details, visit/spend information, wallet/loyalty-related information, and tags.
- **Services:** service categories and catalog information, including price and duration.
- **Staff:** directory and profiles, staff performance, schedules, and staff financial details. The codebase separates recurring booking availability (`working_hours`) from actual attendance records (`attendance_logs`).
- **Sales / POS:** sales containing service/product line items, discounts, payment methods, and optional staff/client associations.
- **Inventory:** products, stock quantities, and low-stock thresholds.
- **Loyalty:** packages, memberships, gift cards, points, and wallet-related functions.
- **Staff financial views:** payroll overview, tips dashboard, staff financial details, commission configuration, and attendance-related data. The existence of these views does not by itself confirm complete payroll processing.
- **Settings and login:** application settings page, login screen, frontend route protection, and API session setup.

The project documentation also lists seeded staff and demo account setup. Demo credentials must be replaced or rotated before wider distribution or production use; credentials are intentionally not reproduced in this document.

### 5.2 Recent additions in the implementation transcript

#### Client Groups

- Added a Client Groups/segments view within the Clients area.
- Added 12 built-in groups calculated from client, appointment, service, membership, gift-card, and spending data:
  - No sale in 30, 60, or 90 days
  - New clients this month
  - Recent visit in the last 7 days
  - VIP clients (lifetime spend threshold)
  - High spenders (weekly average threshold)
  - Hair-service clients
  - Nail-service clients
  - Membership clients
  - Gift-card clients
  - Birthday this month
- Added custom segment creation/editing with named rules and ALL/ANY (`AND`/`OR`) logic.
- Added client-list viewing and CSV export for a segment.
- Added persistent `client_groups` schema and API endpoints for built-in groups, custom group CRUD, member lists, and counts.

#### Finance

- Added a **Payment Summary** screen with a date range, payment-method and staff filters, sales log, payment-method breakdown, and client payment history.
- Added an **Expense Tracker** with expense CRUD, configurable categories, date/category/payment filters, summary indicators, category chart, and CSV export.
- Added three selectable report views:
  - **Profit & Loss:** period revenue, service revenue by category, tracked expenses, and net profit/loss.
  - **Trial Balance:** date-ordered sales and expense entries displayed as credits and debits.
  - **Balance Sheet:** simplified as-of totals for selected cash sales, client wallet balances, gift-card balances, expenses, and calculated equity.
- Added persistent `expenses` and `expense_categories` schemas, corresponding API routes, and API registration.
- The implementation transcript reports that the development schema was pushed and eight default expense categories were seeded.

### 5.3 Current verification

- **Salon web app TypeScript check:** passed during this assessment.
- **API server TypeScript check:** failed with six errors in `inventory.ts`, `loyalty.ts`, and `services.ts`. In each case, numeric values from validated request data are passed to Drizzle numeric columns that require string values. These errors are outside the newly added finance/group route files, but they prevent a clean API typecheck.
- **Database changes:** the prior implementation transcript reports a successful development schema push and category seeding. This document does not include a database export and does not independently certify the current database contents.
- **End-to-end testing:** not recorded. Basic route probes were reported in the prior transcript, but full role-specific, CRUD, edge-case, and financial reconciliation tests remain outstanding.

## 6. Business and functional requirements

Status terms: **Existing** means present in the application before the recent additions; **Added** means present in the current source following the recent implementation; **Follow-up** means required work or business approval remains.

| ID | Requirement | Current status |
|---|---|---|
| BR-01 | Authorized users can sign in and reach only the functions permitted for their role. | Login/session and frontend route protection exist; API-side authorization and role-by-role access must be verified. |
| BR-02 | Managers can review current salon activity and key operational indicators. | Existing dashboard; validate KPI definitions and empty/error states. |
| BR-03 | Staff can manage and review appointments in calendar/list workflows. | Existing; validate rescheduling, status transitions, conflicts, and role permissions. |
| BR-04 | Staff can create and maintain client records and view relevant visit/sales history. | Existing; a Client Groups area was added to the Clients page. |
| BR-05 | Managers can create client segments from standard rules or custom conditions. | Added; verify all rules against approved business definitions and representative records. |
| BR-06 | A user can inspect the members of a segment and export the list. | Added; member views and CSV export are present. Confirm privacy controls and export completeness. |
| BR-07 | Managers can maintain the service catalog and staff directory/configuration. | Existing; API compile issues currently affect service routes. |
| BR-08 | Staff can record salon sales with line items, discounts, payment method, and optional client/staff links. | Existing POS/sales area; validate end-to-end totals and payment handling. |
| BR-09 | Managers can review stock and identify low-stock products. | Existing inventory area; API compile issues currently affect inventory routes. |
| BR-10 | Managers can review package, membership, gift-card, points, and wallet activity. | Existing loyalty area; API compile issues currently affect package routes. |
| BR-11 | Managers can filter and review payment/sales history and payment-method totals. | Added; validate range boundaries, paging, and report-to-sales reconciliation. |
| BR-12 | Authorized users can create, edit, filter, categorize, and remove expense records. | Added; validate input rules, deletion confirmation, audit history, and permissions. |
| BR-13 | Managers can review period-based P&L, trial-balance-style, and balance-sheet-style output. | Added as initial summaries; must be reconciled and approved by the salon’s finance owner before reliance. |
| BR-14 | Users can export relevant client, expense, and financial information. | CSV export exists on new screens; verify encoding, formula-injection handling, and export completeness. |
| BR-15 | Salon settings and operational configuration are manageable within the app. | Existing settings page; exact supported settings need confirmation. |

## 7. Client-group business rules requiring confirmation

The implementation currently uses fixed rules in code. The salon should approve their meaning before these groups are used for client outreach:

1. The “No Sale” groups currently use the client’s `lastVisit` date (or no `lastVisit`) rather than calculating the latest completed sale directly.
2. “New Clients (This Month)” is described as first appointment this month, but the current implementation selects client records created this month.
3. “High Spenders” currently means average lifetime spend divided by weeks since client creation is at least AED 200. Confirm that this is the intended measure.
4. Hair/nail groups depend on category names containing the relevant keywords.
5. Custom group rules currently include last visit days, total spend, average spend per visit, visit count, client-since date, wallet balance, and birthday month. Field/operator behavior needs validation.
6. The custom group evaluator contains a membership rule path that should be corrected or removed before use: its current behavior does not actually query membership status.
7. Built-in group calculation errors can be returned as a count of zero, which may make an unavailable calculation look like a valid empty group. Errors should be surfaced distinctly.

## 8. Finance definitions and limitations

The Finance area is an operational starting point based on sales and expense records, not a substitute for a complete accounting ledger. Before relying on reports for bookkeeping, the salon’s accountant or finance owner should confirm:

- Whether sales totals are gross or net of discounts, refunds, tips, gift cards, and wallet redemptions.
- How service revenue, product revenue, cost of goods sold, wages/commissions, VAT, fees, and cash/card settlement are represented.
- Whether payment method totals reconcile to POS records and actual deposits.
- How dates, cut-off times, voids, refunds, and historical corrections should be handled.
- Which balance sheet accounts are required and how assets, liabilities, and owner equity are calculated.

The current P&L calculation treats total sales as gross profit and subtracts recorded expenses. The trial balance is constructed from sales and expense records rather than a complete double-entry ledger. The balance-sheet-style summary is a simplified calculation, not a fully balanced statement of financial position. Clearly label these views as management summaries until their definitions and reconciliations are approved.

## 9. Data requirements

Core records visible in the current code include:

- **Client:** name, contact information, date of birth, tags, last visit, visit count, total spend, wallet balance, and creation/update timestamps.
- **Appointment:** client, service, staff, time/date, and status.
- **Sale and sale item:** timestamp, client/staff links, subtotal, discount, total, payment method, notes, line-item type/name/quantity/unit and total prices.
- **Staff/service/product:** operational attributes including role, schedule/attendance, commission/financial values, service category/price/duration, and stock quantities.
- **Client group:** name, `AND`/`OR` logic, JSON rule list, and timestamps.
- **Expense category:** category name and creation timestamp.
- **Expense:** category, date, AED amount, description, payment method, receipt reference, entered-by label, and creation timestamp.

Numeric database values use decimal/numeric types. Inputs and outputs must preserve decimal precision and convert values consistently at API boundaries.

## 10. Non-functional and operational requirements

1. **Security:** enforce authentication and role authorization on the server for client exports, finance records, and destructive operations; do not rely on hidden navigation or frontend route checks.
2. **Data integrity:** validate IDs, dates, amounts, rule fields/operators, status transitions, and foreign-key relationships. Reject invalid or negative amounts where not allowed.
3. **Auditability:** record who created, changed, or deleted financial and client-group records; retain an audit trail appropriate to salon policy.
4. **Financial accuracy:** use decimal-safe arithmetic and documented definitions; reconcile totals to sales, discounts, refunds, deposits, and expense source records.
5. **Privacy:** restrict client contact/birthday data and CSV exports to appropriate roles; define retention and deletion policies.
6. **Reliability:** show API failures instead of presenting zero counts or empty reports as if calculations succeeded.
7. **Usability:** provide clear loading, empty, validation, confirmation, and error feedback; ensure key workflows work at desktop and mobile widths.
8. **Maintainability:** keep the API typecheck and database schema/code-generated contracts current; add automated tests for business rules.
9. **Operations:** establish production secrets/configuration, backups, restore procedure, error monitoring, and release/rollback process before launch.

## 11. Priority work still required

### Priority 0 — before production reliance

- Fix the six current API typecheck errors in service, product, and package create/update handlers by converting numeric inputs to the database’s expected decimal representation and validating output.
- Review server-side authorization for all existing and new APIs. Define role permissions and protect finance, staff financial details, client records, and exports.
- Obtain finance-owner/accountant approval for report definitions. Correct the simplified report formulas and label outputs accurately until reconciled.
- Correct/approve the Client Groups definitions, including “new this month,” “no sale,” high-spender calculation, and membership logic.
- Add validation and safe error handling to custom-group, expense, and category routes. Avoid treating calculation failures as valid zero counts.

### Priority 1 — before operational rollout

- Add automated tests for client-group rule evaluation, date boundaries, timezone behavior, expense CRUD, filtering/pagination, and financial totals.
- Add end-to-end acceptance checks for login, create/edit/delete, permission restrictions, export, and multi-step POS/expense/report workflows.
- Add audit records and explicit confirmation for deleting expenses/categories/groups; ensure category deletion does not silently impair historical reporting.
- Validate payment-summary paging and export all matching rows rather than only the subset loaded into the screen.
- Confirm the AED formatting, Asia/Dubai date handling, business-day cut-offs, and month boundaries.
- Add meaningful request validation and response schemas; avoid untyped `any` paths where financial calculations are involved.

### Priority 2 — post-launch enhancements

- Attach and store receipt images/documents, with access controls and retention rules.
- Add scheduled follow-up workflows or approved messaging integrations for client segments.
- Add accounting-system exports/integration and settlement reconciliation if required by the salon.
- Add broader reporting, saved filters, and management-defined thresholds after initial usage feedback.

## 12. Acceptance criteria for the recent additions

### Client Groups

- Each built-in group count matches its approved business definition for a known test dataset.
- Selecting a group shows the exact matching clients and the displayed count matches the list.
- A custom group can be created, edited, viewed, exported, and deleted; all/any conditions yield expected results.
- Invalid rules, unavailable data, and API errors are shown as errors, not misleading empty groups.
- Only permitted staff can access client data and download contact details.

### Finance

- Expense records can be added, edited, filtered, exported, and removed with validated amounts, dates, and categories.
- Payment totals reconcile to sales records for each supported payment method and date range.
- Each report reconciles to source transactions and uses the definitions approved by the finance owner.
- Date filters include the intended start/end dates in Asia/Dubai time.
- API and frontend typechecks pass, and tests cover empty, boundary, error, and large-result cases.

## 13. Assumptions, dependencies, and decisions needed

- The salon is the initial operating organization; multi-branch support has not been established.
- The default reporting currency is AED.
- PostgreSQL is the application data store and Drizzle schemas are the source of truth.
- The recent development schema push and category seed were reported by the prior implementation transcript; the source archive contains source/configuration, not live database contents.
- The business must decide whether this app is an operational CRM with management summaries or is expected to be an accounting system of record.
- The salon must approve the role-permission matrix, retention rules, segment definitions, and finance formulas.
- External payment, accounting, messaging, or email services are not included in the current implementation scope.

## 14. Source package contents and setup notes

The accompanying source archive contains the current workspace source for the salon web application, API server, shared libraries, scripts, workspace configuration, lockfile, and project notes. It excludes installed dependencies, local caches, Git history, local agent configuration/memory, uploaded reference files, live database contents, and environment secrets.

To run the project outside the current environment, install the required Node.js/pnpm versions, install from the included lockfile, configure the required database URL and session secret through a secure secrets manager, apply the database schema, and run the API and web workflows. Do not commit production secrets or use demo credentials in a deployed environment.

## 15. Conclusion

The project has a broad salon-CRM foundation and the recent work adds useful first versions of client segmentation and financial visibility. The next release should focus on correctness and trust: clear business definitions, API-level permissions, decimal-safe handling, reconciled report logic, validation, auditability, and repeatable tests. The downloadable code package represents the current source snapshot; it does not include production data or establish that the remaining items are complete.