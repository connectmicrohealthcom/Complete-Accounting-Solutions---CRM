# Layal Al Zahra Salon CRM

A fully custom CRM for Layal Al Zahra salon in Dubai, replacing Fresha/Zylu subscriptions.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080, path `/api`)
- `pnpm --filter @workspace/salon-crm run dev` — run the frontend (port 23395, path `/`)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/scripts run seed-salon` — seed real staff + services data
- Required env: `DATABASE_URL` — Postgres connection string, `SESSION_SECRET` — Express session secret

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5 (port 8080, path `/api`)
- Frontend: React 19 + Vite 7 + Tailwind CSS + shadcn/ui + Wouter routing
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec) → `@workspace/api-client-react`
- Charts: Recharts
- Build: esbuild (CJS bundle)

## Where things live

- `lib/db/src/schema/` — all Drizzle ORM schemas (source of truth for DB)
- `lib/api-zod/src/generated/` — generated Zod schemas + API hooks (do NOT edit manually)
- `artifacts/api-server/src/routes/` — Express route handlers
- `artifacts/salon-crm/src/pages/` — React page components
- `artifacts/salon-crm/src/components/layout.tsx` — sidebar navigation
- `artifacts/salon-crm/src/App.tsx` — Wouter routing

## Product

**Complete salon management system:**
- **Dashboard** — KPIs, revenue chart, upcoming appointments, top services
- **Appointments** — Calendar view, list view, analytics & summary
- **Clients** — Full CRM with loyalty points, package history, membership tracking
- **Services** — Service catalog with categories, pricing, duration
- **Staff** — Directory, performance tracking, schedule (attendance), Financial Details (wages, commission slabs, tips, working hours log)
- **Sales / POS** — New transactions with services + products, tips capture, payment methods
- **Inventory** — Product management with stock levels and low-stock alerts
- **Loyalty** — Packages, memberships, gift cards, wallet/points system
- **Tips** — Staff tips dashboard with date range filtering, breakdown by staff, CSV export
- **Settings** — Salon configuration

## Staff (seeded)

- Shobha Sharma — Stylist, Hair Treatments
- Do Thi Hong — Stylist, Gel Nails & Gelish
- Hoang Huong Ly — Stylist, Gel Nails Refill
- Manjusha Rajan — Stylist, Eyebrow Tinting & Threading
- Pramika Bhujel — Therapist, Massage Services

Admin login: `admin@layalalzahra.com` / `admin123`
Staff login: e.g. `shobha@layalalzahra.com` / `staff123`

## Architecture decisions

- API uses Express 5 with async route handlers returning `Promise<void>`, no `next()` needed
- Drizzle numeric columns store numbers as strings; always convert with `String()` on insert and `Number()` on read
- All new financial endpoints are added directly to `staff.ts` route file (not via OpenAPI codegen) — use direct `fetch` in frontend pages for these
- The `working_hours` table = booking availability schedule (Mon–Sun); `attendance_logs` table = actual daily clock-in/out records
- Commission is calculated via tiered `commission_slabs` if configured; falls back to `staff.commission_rate` if no slabs exist

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- When adding new Drizzle schema tables, run `pnpm run typecheck:libs` BEFORE checking api-server — stale `.d.ts` declarations cause false "not exported" errors
- `staff_role` enum values: `admin`, `manager`, `receptionist`, `stylist`, `therapist` — no "staff" value
- `working_hours.start_time` is NOT NULL — don't insert rows for days-off; only insert rows for working days
- New financial API endpoints use direct `fetch` in frontend, not the codegen hooks (no OpenAPI spec update needed)
- Run `pnpm --filter @workspace/db run push` after any schema changes to the `lib/db/src/schema/` files

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
