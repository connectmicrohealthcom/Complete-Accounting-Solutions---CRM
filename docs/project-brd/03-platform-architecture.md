# Platform Architecture

## Target architecture
The platform should evolve from the current single-organization application into a configurable product platform.

### Organization layer
Every customer deployment or tenant must have:
- organization ID
- organization settings
- enabled product modules
- enabled features
- users/staff
- roles and permissions
- audit records
- integration configuration

### Entitlement model
1. Module entitlement — Salon, CRM, Accounting.
2. Feature entitlement — Gift Cards, Payroll, VAT Reports, etc.
3. Role permission — view/create/edit/delete/export.

Hiding a menu item is not authorization. The API must enforce entitlement and permission checks.

### Data isolation
For a future multi-tenant deployment, business records must be scoped to the organization. Object IDs must never allow one organization to retrieve another organization's data.

### Configuration over forks
Do not create separate code forks for every customer. Use configuration, module entitlements and reusable templates.

### Reporting
Business calculations should live in reusable server-side services or query modules. Dashboard cards, module reports and the central Reports hub must use the same calculation logic.

### Integrations
External payment, WhatsApp/SMS, accounting and email services should be adapters configured per organization.

### Migration
Schema changes require migration planning, backup/restore consideration and test validation. Do not use ad-hoc production schema pushes as the long-term migration strategy.
