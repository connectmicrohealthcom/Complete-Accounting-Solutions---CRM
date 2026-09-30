# Complete Accounting Solutions — Master BRD

Status: Active long-term build
Last reviewed: 30 September 2026

## Product
Complete Accounting Solutions is a reusable business-management platform. It began as a salon CRM/booking/POS concept and is being expanded into a modular platform that can support different customer types from one codebase.

## Product families
### Salon Management
Appointments, availability, clients, services, POS, inventory, loyalty, memberships, gift cards, tips, staff finance, expenses and salon reporting.

### CRM / Business Development
A future CRM edition for contacts, companies, leads, opportunities, activities, pipelines, follow-ups and CRM reporting. Detailed requirements are not yet approved.

### Accounting / Finance
A future accounting edition. The current finance module is an operational management-summary layer, not yet a complete accounting system.

## Core principle
One platform, modular activation. A customer instance should receive only the modules and features approved for that customer.

The target architecture therefore needs organization identity, module entitlements, feature configuration, roles, permissions and strict data isolation.

## Current vs target
Current implementation is primarily a single-organization salon-oriented application. Multi-tenant productization is a target architecture and must not be assumed to already exist.

## Historical source
The original requirements mention Layal Al Zahra, Fresha, Zylu and Salonist because that was the original business context. Those references must not become the identity, branding, credentials or default customer data of the current product.

## Release rule
A feature is complete only when UI, API, database, permissions, error handling, tests and documentation are aligned and the relevant acceptance criteria pass.
