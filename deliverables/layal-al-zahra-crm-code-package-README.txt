LAYAL AL ZAHRA SALON CRM — SOURCE AND DOCUMENTATION PACKAGE

This smaller ZIP is an alternate way to obtain the project's current source code.
It includes the app and API source, shared libraries, scripts, workspace
configuration, BRD, and handoff notes.

To restore in a new Replit workspace:
1. Extract the ZIP at the project root.
2. Run: pnpm install
3. Provision a PostgreSQL database for the new workspace.
4. Add a fresh SESSION_SECRET using Replit Secrets. DATABASE_URL is supplied by
   the provisioned Replit database in a managed setup.
5. For a fresh development database, run:
   pnpm --filter @workspace/db run push
6. Start the API and frontend using the project workflows or:
   pnpm --filter @workspace/api-server run dev
   pnpm --filter @workspace/salon-crm run dev

This source package does not include .git history, node_modules, caches,
Replit's cached environment, live database records, or secret values. The full
workspace archive contains Git history and cache material. Reinstalling
dependencies from pnpm-lock.yaml is recommended.

The API typecheck had six numeric-type errors in service, inventory, and loyalty
routes during the prior handoff check; review the handoff notes before treating
the project as production-ready.