# API & Security

## Current
Authentication is session-based. Frontend protected routes exist. The production deployment uses secure cross-origin session configuration between Vercel and Render.

## Required security model
Authentication answers who is signed in. Authorization separately answers what that user is allowed to do.

The API must enforce:
- role permissions
- organization/module entitlements
- object ownership/tenant scope
- export permissions
- destructive-action permissions
- finance/accounting permissions

## High-risk operations
Require server-side authorization and confirmation for deleting financial records, deleting clients, changing commission/wage rules, exporting client contact data, exporting financial data and changing organization configuration.

## Secrets
Never commit database URLs, session secrets, API keys, payment gateway secrets, WhatsApp/SMS credentials or real customer passwords.

## Session
The current Express session uses server-side session state. The development configuration uses Express MemoryStore. A durable session store is required before production use with multiple instances or restart-sensitive sessions.

## Audit
The target platform needs audit logs for security-sensitive and financial changes, including actor, timestamp, action, entity and relevant before/after values.

## Privacy
Client phone numbers, birthdays, payment information and exports must be permission-controlled. Messaging features must include consent and opt-out handling.
