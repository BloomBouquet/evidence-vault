# Baseline scope

This branch intentionally migrates the already-written Evidence Vault baseline without adding new MVP features.

Included:
- Next.js application shell and landing UI
- health endpoint
- product/legal disclaimer copy
- domain schemas and tests
- Drizzle PostgreSQL schema
- owner-scoped repository reads
- app-session repository
- PKCE/state/login-attempt OAuth security primitives and tests
- repository CI and migration provenance

Deferred to dependency-following Luna tasks:
- complete 꽃다발 callback/token/userinfo/session routes
- authenticated dashboard and CRUD
- evidence object storage and signed downloads
- case/export/deletion workflow
- production deployment

This boundary keeps the migration reviewable and avoids silently mixing legacy transfer with new feature implementation.
