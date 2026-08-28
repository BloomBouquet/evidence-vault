# BE-003 Integration Verification

## Purpose

This document records the post-`develop` integration state of BE-003 (Vault/Deadline/Event owner-scoped API). It supersedes the pre-integration migration numbering and verification notes for BE-003 in `docs/VERIFICATION.md` and the original implementation plan where those notes refer to `drizzle/0000_optional_merchant.sql` or state that PostgreSQL migration execution had not been verified.

## Integration baseline

BE-003 was originally developed before the canonical `develop` branch gained the committed database baseline and BE-004 deletion-job migration. After PR #13 merged, canonical `develop` was at:

```text
79d0596f4977e2a3c4224104e6c37a90179c7344
```

The BE-003 branch was synchronized through two-parent merge commit:

```text
6f082bfd55cd8b8506736de2ff36f605c50297eb
```

The merge preserved the BE-003 owner-scoped API implementation while retaining the BE-004 deletion-job unique index in `src/db/schema.ts`.

## Migration conflict resolution

Canonical `develop` already owned these migration slots:

```text
0000_evidence_vault_initial
0001_deletion_job_idempotency
```

Therefore the original BE-003 nullable-merchant migration could not remain `0000_optional_merchant`. The integrated contract is:

```text
0000_evidence_vault_initial
0001_deletion_job_idempotency
0002_optional_merchant
```

`drizzle/0002_optional_merchant.sql` contains only:

```sql
ALTER TABLE "ev_vault_items" ALTER COLUMN "merchant_name" DROP NOT NULL;
```

The Drizzle journal records the same order. The merged schema keeps both required changes: nullable `merchant_name` and the BE-004 `ev_deletion_jobs_owner_kind_target_unique` index.

## Integration TDD evidence

### RED

CI run `33144228299` checked out merge commit `6f082bfd55cd8b8506736de2ff36f605c50297eb`.

Observed result:

```text
pnpm db:migrate  PASS — canonical 0000/0001 migrations apply to PostgreSQL 16
pnpm test:run    FAIL — 60 test files / 233 tests PASS, exactly 1 new migration-contract test FAIL
```

The only failure was:

```text
PostgreSQL migration contract > ships the nullable merchant migration after existing develop migrations
```

It failed because `drizzle/0002_optional_merchant.sql` intentionally did not exist yet. No BE-003 API, ownership, auth, BE-004 storage, or existing migration test failed in the RED state.

### GREEN

Commit:

```text
08b8750189cdb6b873b9819fe43daf2b77177937
fix: sequence nullable merchant migration
```

CI run `33144357579` checked out that exact branch HEAD and observed:

```text
pnpm install --frozen-lockfile  PASS
pnpm db:migrate                PASS — PostgreSQL 16 container, committed 0000/0001/0002 chain
pnpm test:run                  PASS — 61 test files / 234 tests
pnpm build                     PASS — Next.js 16.3.3 production build + TypeScript
```

The build included the BE-003 routes together with the already-merged auth and BE-004 storage routes:

```text
/api/dashboard
/api/vault-items
/api/vault-items/[id]
/api/vault-items/[id]/archive
/api/vault-items/[id]/deadlines
/api/vault-items/[id]/deadlines/[deadlineId]
/api/vault-items/[id]/events
/api/vault-items/[id]/events/[eventId]
/api/vault-items/[id]/evidence-files
/api/evidence-files/[id]
/api/evidence-files/[id]/download
```

Preview run `33144357583` also passed exact-source install, committed migration verification, unit tests, and production build. `server-probe` and `deploy` were skipped by workflow policy for the PR.

## Ownership/security review

Post-integration review confirmed:

- VaultItem list/read/update/archive queries constrain `user_id` to the authenticated local owner.
- Deadline and Evidence Event production list/update/delete queries constrain nested rows through an owned parent VaultItem.
- request payload ownership fields are not trusted; route dependencies receive the session-derived owner.
- missing and cross-user resources use the same `404 { "error": "not_found" }` contract.
- protected JSON responses are non-cacheable.
- public VaultItem DTOs omit `userId`; Event API DTOs do not expose `createdByUserId`.
- dashboard SQL reads only caller-owned active VaultItems and their active deadline/event projections.
- BE-004 private evidence storage tests remain green in the integrated suite.

No Critical or Important integration blocker was identified in this review.

## Not claimed by this evidence

This verification does not claim:

- production database migration execution,
- live external S3 upload/download/deletion,
- a deployed end-to-end Bouquet login + domain CRUD browser flow,
- final browser accessibility/visual QA,
- release readiness before the remaining Luna review/QA/User Agent gates.
