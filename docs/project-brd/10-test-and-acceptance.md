# Test & Acceptance

## Global release gate
A feature is complete only if UI works, API works, database reads/writes are correct, authorization works, refresh/session behavior works, loading/empty/error states work, typecheck/build passes, relevant tests pass and documentation is updated.

## Authentication
- valid admin login
- invalid password
- inactive user
- logout
- refresh while authenticated
- direct protected route
- missing/expired session

## Appointments
- create/edit/cancel/complete/reschedule
- conflict detection
- availability filtering
- duration/end time
- price calculation

## Sales/POS
- service sale
- product sale
- discount
- tip
- payment methods
- wallet/gift-card redemption
- totals
- inventory effect

## Finance
- expense CRUD
- payment summary reconciliation
- date boundaries
- category filters
- exports
- report calculations

## Client Groups
- every default group against known fixtures
- AND/OR custom groups
- zero-result group
- invalid rule
- calculation failure
- export

## Security
- every role
- unauthorized API call
- unauthorized export
- cross-organization access once multi-tenant

## Test fixtures
Use non-production fixtures covering clients with/without visits, multiple service categories, memberships, gift cards, wallet transactions, staff schedules, attendance, multiple payment methods, expenses and boundary dates.
