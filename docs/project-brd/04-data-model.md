# Data Model

## Current declared areas
The handoff documentation identifies 28 current tables.

### Core and scheduling
staff, working_hours, clients, client_groups, service_categories, services, appointments

### Sales and operations
sales, sale_items, products, expense_categories, expenses

### Loyalty and stored value
packages, package_services, client_packages, client_package_usage, membership_plans, membership_plan_services, client_memberships, client_membership_usage, gift_card_types, gift_cards, wallet_transactions

### Staff finance and attendance
tips, attendance_logs, staff_wage_settings, wage_payments, commission_slabs

## Semantic rules
- working_hours = booking availability.
- attendance_logs = actual attendance.
- Decimal/numeric database values are represented as strings at the Drizzle TypeScript boundary.
- Staff roles currently include admin, manager, receptionist, stylist, therapist.

## Target platform entities
Before multi-tenant rollout, design and approve:
- organizations
- organization settings
- module entitlements
- feature configuration
- users/staff membership
- roles
- permissions
- role-permission mapping
- audit logs
- integration configuration
- notification templates

## Accounting entities still required
A proper Accounting edition will likely require chart of accounts, journal entries, journal lines, account balances, tax configuration, payment allocations, reconciliation records and period controls. These are target entities, not current schema claims.
