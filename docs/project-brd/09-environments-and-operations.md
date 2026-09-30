# Environments & Operations

## Current
Source: GitHub repository Complete-Accounting-Solutions---CRM.
Frontend: Vercel.
API: Render.
Database: Supabase PostgreSQL.

## Environment variables
- DATABASE_URL
- SESSION_SECRET
- NODE_ENV
- VITE_API_BASE_URL

Actual values remain in platform environment settings/secrets.

## Development restore
Historical handoff procedure:
pnpm install
pnpm --filter @workspace/db run push
pnpm --filter @workspace/salon-crm run dev
pnpm --filter @workspace/api-server run dev

Seed scripts must be reviewed before use against any database containing real records.

## Release process
1. Update requirements/decision log if scope changes.
2. Implement code and schema.
3. Run typecheck.
4. Run tests.
5. Run build.
6. Review migration impact.
7. Commit to main only when ready.
8. Verify Vercel and Render deployments.
9. Smoke-test login and changed modules.
10. Update issue/change/test records.

## Backup/restore
A production backup and restore procedure is not yet established. This is a production-readiness blocker.

## Secrets
Do not store passwords or secrets in GitHub. Historical demo credentials must be considered exposed and rotated before external distribution.
