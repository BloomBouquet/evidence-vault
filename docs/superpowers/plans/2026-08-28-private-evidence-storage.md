# Private Evidence Storage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement authenticated private evidence upload, integrity fingerprinting, local/S3 storage, short-lived download authorization, and deletion reconciliation for BE-004.

**Architecture:** A server-only `EvidenceStorage` adapter isolates local filesystem and S3-compatible providers. Route handlers resolve the application session, services enforce ownership/validation/integrity and compensate partial failures, and repositories persist only metadata/deletion state. Local downloads stream through the authenticated app route; S3 downloads return a 300-second signed redirect target only after owner verification.

**Tech Stack:** Next.js 16 App Router, TypeScript, Drizzle ORM/PostgreSQL, Node `crypto`/`fs`, AWS SDK S3 + presigner, Vitest.

**Spec:** `docs/superpowers/specs/2026-08-28-private-evidence-storage-design.md`

## Global Constraints

- Allowed upload MIME types: `application/pdf`, `image/jpeg`, `image/png`, `image/webp`.
- Maximum upload size: exactly 20 MiB (`20 * 1024 * 1024` bytes); empty files are rejected.
- Production rejects `STORAGE_DRIVER=local`; production S3 signed-download TTL is exactly 300 seconds.
- Storage keys are server-generated as `users/<ownerUserId>/evidence/<evidenceFileId>` and never contain raw filenames.
- SHA-256 is an integrity fingerprint only; no authenticity/admissibility/legal-effect claims.
- Missing, deleted, and cross-user file access use the same not-found contract.
- Protected evidence responses use `Cache-Control: no-store` and never expose bucket names, storage keys, credentials, raw provider errors, or absolute local paths.
- Automatic deletion reconciliation is bounded to five attempts; exhausted/permanent failures remain blocked, never completed.
- Real S3/PostgreSQL/browser/deployment checks are not claimed unless actually executed.

---

### Task 1: Storage configuration, types, key generation, and file validation

**Files:**
- Create: `src/storage/config.ts`
- Create: `src/storage/types.ts`
- Create: `src/storage/key.ts`
- Create: `src/storage/validation.ts`
- Create: `src/storage/config.test.ts`
- Create: `src/storage/validation.test.ts`

**Interfaces:**
- Produces: `parseStorageConfig(env)`, `EvidenceStorage`, `EvidenceDownloadTarget`, `buildEvidenceStorageKey(ownerUserId, evidenceFileId)`, `validateEvidenceUpload(input)`, `sha256Hex(bytes)`.

- [ ] Write failing tests for local/S3 config, production-local rejection, missing S3 secrets, allowed MIME types, empty/oversize rejection, 20 MiB boundary, known SHA-256 fixture, and filename-independent storage keys.
- [ ] Run `pnpm test:run` and verify only the new storage-contract suites fail because the modules do not exist.
- [ ] Implement the minimal server-only config/types/key/validation modules. `parseStorageConfig` returns a discriminated union; `validateEvidenceUpload` returns normalized filename/MIME/size; `sha256Hex` hashes the exact `Uint8Array`.
- [ ] Run `pnpm test:run` and `pnpm build`; both must pass.
- [ ] Commit with `feat: add evidence storage contracts`.

### Task 2: Local and S3 storage adapters

**Files:**
- Create: `src/storage/local-storage.ts`
- Create: `src/storage/s3-storage.ts`
- Create: `src/storage/storage-factory.ts`
- Create: `src/storage/errors.ts`
- Create: `src/storage/local-storage.test.ts`
- Create: `src/storage/s3-storage.test.ts`

**Interfaces:**
- Consumes: `EvidenceStorage`, parsed storage config.
- Produces: `LocalEvidenceStorage`, `S3EvidenceStorage`, `createEvidenceStorage(config)`, normalized `StorageOperationError` categories.

- [ ] Write failing tests that local storage writes only under the configured root, rejects path escape, returns bytes rather than filesystem paths, and treats missing delete as success; mock AWS commands to verify private `PutObjectCommand`, `DeleteObjectCommand`, and `GetObjectCommand` signing with `expiresIn: 300`.
- [ ] Verify RED with `pnpm test:run`.
- [ ] Implement adapters using `fs/promises` for local and AWS SDK for S3. Do not set public ACLs. Normalize provider failures without including raw provider bodies/credentials.
- [ ] Run tests/build and verify GREEN.
- [ ] Commit with `feat: add private evidence storage adapters`.

### Task 3: Evidence metadata and deletion-job repositories

**Files:**
- Modify: `src/repositories/evidence-repository.ts`
- Create: `src/repositories/evidence-repository.test.ts`
- Create: `src/repositories/deletion-job-repository.ts`
- Create: `src/repositories/deletion-job-repository.test.ts`

**Interfaces:**
- Produces: `createEvidenceFile`, `markEvidenceFileDeleted`, `getEvidenceFile`, `createDeletionJob`, `getDeletionJob`, `markDeletionJobCompleted`, `markDeletionJobRetryable`, `markDeletionJobBlocked`.

- [ ] Add failing adapter-backed repository contract tests proving owner-scoped reads exclude deleted rows, metadata insert persists the exact storage key/hash/size, deletion is idempotent, and deletion job state transitions preserve bounded attempts/error codes.
- [ ] Verify RED.
- [ ] Implement minimal Drizzle repository functions; user ownership is always part of file selection/update conditions.
- [ ] Run tests/build and verify GREEN.
- [ ] Commit with `feat: add evidence persistence primitives`.

### Task 4: Upload service with SHA-256 and compensation

**Files:**
- Create: `src/services/evidence-file-service.ts`
- Create: `src/services/evidence-file-service.test.ts`

**Interfaces:**
- Produces: `uploadEvidenceFile(input, deps)`, `EvidenceFileDto`, `EvidenceServiceError`.
- Dependencies: owned VaultItem lookup, optional owned Event lookup adapter, `EvidenceStorage`, evidence repository, deletion-job repository.

- [ ] Write failing tests for owned upload success, unsupported/oversize/empty files, foreign VaultItem, mismatched Event, storage failure with no metadata, DB failure with successful compensation, and DB failure + failed compensation creating a reconciliation job.
- [ ] Verify RED.
- [ ] Implement service in this exact order: ownership checks → validation → allocate evidence-file id → deterministic key → hash exact bytes → storage put → metadata insert. On metadata failure, immediately delete object; if delete fails, enqueue deletion reconciliation using the deterministic target id/key contract.
- [ ] Verify GREEN with full tests/build.
- [ ] Commit with `feat: add evidence upload service`.

### Task 5: Protected upload and download routes

**Files:**
- Create: `app/api/vault-items/[id]/evidence-files/route.ts`
- Create: `app/api/vault-items/[id]/evidence-files/route.test.ts`
- Create: `app/api/evidence-files/[id]/download/route.ts`
- Create: `app/api/evidence-files/[id]/download/route.test.ts`

**Interfaces:**
- Upload: `POST /api/vault-items/[id]/evidence-files` multipart `file` + optional `evidenceEventId`.
- Download: `POST /api/evidence-files/[id]/download`; local target returns protected bytes response; S3 target returns a temporary redirect/no-store response.

- [ ] Write failing route-factory tests for 401 anonymous, 404 cross-user/missing, multipart validation errors, DTO privacy, local byte download, S3 redirect, deleted-file denial, and no-store headers.
- [ ] Verify RED.
- [ ] Implement thin route handlers using `cookies().get("ev_session")`, `resolveProtectedUser`, the storage factory, and services. Do not serialize storage keys or provider errors.
- [ ] Verify GREEN with full tests/build.
- [ ] Commit with `feat: add protected evidence file routes`.

### Task 6: Immediate revoke, physical deletion, and bounded reconciliation

**Files:**
- Create: `src/services/deletion-reconciliation.ts`
- Create: `src/services/deletion-reconciliation.test.ts`
- Create: `app/api/evidence-files/[id]/route.ts`
- Create: `app/api/evidence-files/[id]/route.test.ts`

**Interfaces:**
- Produces: `requestEvidenceDeletion(input, deps)` and `processDeletionJob(jobId, deps)`.
- Delete API: `DELETE /api/evidence-files/[id]` returns accepted/revoked state without claiming physical deletion complete.

- [ ] Write failing tests for immediate `deletedAt`, immediate future-download denial, job creation/idempotency, successful physical deletion, provider not-found success, transient retry increment, permanent failure blocked immediately, fifth failed attempt blocked, repeated completed processing no-op, and normalized error exposure.
- [ ] Verify RED.
- [ ] Implement deletion request and reconciliation processor with max attempts = 5 and statuses `queued`, `retryable`, `completed`, `blocked`.
- [ ] Implement protected DELETE route with 401/404/no-store and neutral accepted response.
- [ ] Verify GREEN with full tests/build.
- [ ] Commit with `feat: add evidence deletion reconciliation`.

### Task 7: Cross-user security regression and final evidence

**Files:**
- Create: `src/server/evidence-storage-security.test.ts`
- Modify: `docs/VERIFICATION.md`

**Interfaces:**
- Verifies public behavior of upload/download/delete route factories and service adapters.

- [ ] Add regression tests proving user A cannot read metadata, receive a download target, or delete user B evidence and receives the same status/body as a nonexistent id.
- [ ] Run `pnpm test:run` and ensure the regression suite passes without weakening the contract.
- [ ] Run `pnpm build`.
- [ ] Update `docs/VERIFICATION.md` with RED/GREEN run IDs and the final verified branch SHA. Explicitly list real S3/PostgreSQL/browser/deployment checks as not claimed unless executed.
- [ ] Re-run `pnpm install --frozen-lockfile`, `pnpm test:run`, and `pnpm build` on the final documentation HEAD.
- [ ] Open/update a Draft PR to `develop` using the required PR template. Keep independent Code Review/Reviewer/QA as later gates.
- [ ] Commit with `docs: record private storage verification`.
