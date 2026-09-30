# Issues & Fixes

## Active / verify

### ISS-001 — API numeric type errors
Status: Open until rechecked and fixed.
Area: services, inventory, loyalty.
Problem: numeric request values are passed to Drizzle numeric columns expecting string representations.
Action: fix conversion, typecheck and test affected create/update routes.

### ISS-002 — Client group definitions
Status: Open.
No-sale logic, new-client definition, high-spender calculation, category matching and membership rule behavior require approval/correction.

### ISS-003 — Finance is not accounting-grade
Status: Open.
Current P&L, trial balance and balance-sheet views are management summaries based on sales/expenses, not a full double-entry ledger.

### ISS-004 — API authorization matrix
Status: Open.
Frontend route protection is not sufficient. Define and enforce server permissions.

### ISS-005 — Audit trail
Status: Open.
Add platform audit logging for financial, permission and destructive operations.

### ISS-006 — Export completeness
Status: Open.
Exports must include all filtered records, not only the current page.

### ISS-007 — Production session storage
Status: Open.
Replace development MemoryStore before production-scale use.

### ISS-008 — Online booking/integrations
Status: Backlog.
Design public booking, payment gateway and messaging adapters separately from core business logic.

## Fixed during current deployment

### FIX-001 — Vercel SPA hard-refresh routing
Fixed. Client-side routes survive hard refresh.

### FIX-002 — Cross-origin production session handling
Fixed. Login session persists between Vercel frontend and Render API.

### FIX-003 — Development product branding
Fixed. Visible branding changed from historical Layal Al Zahra branding to Complete Accounting Solutions.
