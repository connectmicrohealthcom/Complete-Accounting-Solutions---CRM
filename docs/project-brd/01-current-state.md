# Current State

## Verified baseline
Repository: Complete-Accounting-Solutions---CRM, branch main.

Stack:
- React 19
- Vite
- Tailwind CSS / shadcn/ui
- Wouter
- Express 5
- PostgreSQL
- Drizzle ORM
- Zod
- Orval-generated API client
- Recharts
- pnpm workspaces

## Current deployment
- Frontend: Vercel
- API: Render
- Database: Supabase PostgreSQL
- Production-style frontend/API session configuration has been fixed and login has been verified.
- Vercel SPA routing has been fixed so client routes survive hard refresh.

## Current UI modules
Dashboard, Calendar, Appointments, Clients, Services, Staff, Payroll, Tips, Sales/POS, Inventory, Loyalty, Payments, Expenses, Financial Reports and Settings are present in the current frontend navigation.

## Important semantic distinction
working_hours = booking availability schedule.
attendance_logs = actual attendance / clock-in / clock-out.

Booking must use availability, not attendance.

## Known technical debt
The existing handoff records six API typecheck errors involving numeric values passed to Drizzle numeric columns in inventory, loyalty and services routes. Re-run typecheck before the next major feature build and close these errors.

Other known gaps:
- formal API role authorization matrix
- accounting-grade financial model/reconciliation
- audit trail
- automated end-to-end test suite
- production backup/restore and monitoring
- complete validation of client-group business rules
- export completeness and date-boundary testing

## Historical requests not assumed complete
The eight historical prompts include online booking, payment gateway, birthday outreach, appointment reminders, enhanced loyalty, payroll automation, finance reports, sales analytics and a central reports hub. These remain backlog items unless verified in source and tests.
