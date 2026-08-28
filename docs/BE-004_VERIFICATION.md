# BE-004 Private Evidence Storage Verification

## Scope

BE-004 implements the server-side private evidence file boundary for Evidence Vault:

- server-only local and S3-compatible storage adapters,
- server-side file validation and SHA-256 integrity metadata,
- owner-scoped upload, download, and deletion routes,
- five-minute signed S3 downloads,
- immediate application-level deletion revocation,
- bounded object-deletion reconciliation,
- database-level deletion-job idempotency,
- cross-user negative security regressions.

## Security contract verified by automated tests

The automated suite covers these negative and privacy-sensitive behaviors:

- user A cannot upload a file into user B's vault before any object write occurs,
- user A cannot obtain a download target for user B's evidence,
- missing and foreign evidence use the same not-found behavior,
- signed storage access is not requested before owner authorization succeeds,
- deleting owned evidence sets application-level revocation before the request is accepted,
- a revoked file cannot reach the storage download boundary afterward,
- user A cannot delete user B's evidence,
- upload/download/delete responses use normalized public errors and `Cache-Control: no-store`,
- S3 download targets are generated with a 300-second expiry,
- deletion reconciliation treats provider not-found as completed, retries transient failures, stops after five attempts, and blocks permanent failures,
- `(user_id, kind, target_id)` deletion-job uniqueness is enforced by PostgreSQL migration `0001_deletion_job_idempotency.sql`.

## TDD and failure evidence

| Stage | GitHub Actions run | Observed result |
|---|---:|---|
| protected upload/download route RED | `33140514854` | failed before the protected route implementation existed |
| route GREEN candidate | `33140698028` | existing suites passed; new route tests exposed jsdom `File`/TypedArray realm issues |
| protected upload/download route GREEN | `33140867683` | migration, unit tests, and production build passed after removing realm-identity assumptions |
| deletion reconciliation RED | `33141059750` | existing 156 tests passed; new deletion service/DELETE route and idempotency migration were intentionally missing |
| deletion reconciliation GREEN | `33141357990` | migration, full unit suite, and production build passed |
| owner-isolation regression GREEN | `33141454390` | 42 test files / 176 tests passed and production build passed |
| post-`develop` integration verification | `33142205240` | PostgreSQL migration, 42 test files / 176 tests, and Next.js production build all passed |

The feature branch was synchronized with `develop` using merge commit `e4087c7fee9cb3c67e706b9a23f44d7a9045693d`. At that integration point the branch comparison was `ahead 38 / behind 0` relative to `develop`.

## Final automated verification

CI run: `33142205240`

```text
pnpm install --frozen-lockfile  PASS
pnpm db:migrate                PASS — PostgreSQL 16 container
pnpm test:run                  PASS — 42 test files, 176 tests
pnpm build                     PASS — Next.js 16.3.3 production build + TypeScript check
```

The production build included these BE-004 routes:

```text
/api/vault-items/[id]/evidence-files
/api/evidence-files/[id]/download
/api/evidence-files/[id]
```

Preview verification run `33142205153` also passed dependency installation, committed migration verification, unit tests, and production build on the same integrated source. Its `server-probe` and `deploy` jobs were skipped by workflow conditions, so this evidence is not a claim that the branch was deployed to a live server.

## Not yet claimed as PASS

BE-004 does **not** claim the following as verified yet:

- a real external S3-compatible provider with production credentials,
- live signed-URL download against that provider,
- production-region object deletion and reconciliation against real provider failures,
- a deployed browser end-to-end upload/download/delete workflow using real Bouquet SSO,
- manual browser accessibility/visual checks for evidence UI that will be implemented by later frontend tasks.

No provider credentials, signed URLs, storage keys, or private object contents are recorded in this document.
