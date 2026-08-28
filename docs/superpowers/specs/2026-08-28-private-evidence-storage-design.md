# Private Evidence Storage Design

Date: 2026-08-28
Team: 해바라기
Task: BE-004 — Private evidence storage + integrity + deletion primitives
Branch: `agent/해바라기/backend/private-evidence-storage`
Base: `develop`

## 1. Context

Evidence Vault stores user-provided files that may later be attached to a purchase, timeline event, case, or export packet. The repository already has:

- private-storage environment placeholders for local and S3-compatible storage,
- AWS S3 client and presigner dependencies,
- `evidenceFiles` metadata with owner, vault, optional event, storage key, MIME type, byte size, SHA-256, redaction state, and soft-deletion timestamp,
- `deletionJobs` metadata for queued deletion/retry state,
- owner-scoped evidence lookup by authenticated user.

BE-004 turns those primitives into a complete storage boundary without claiming that a SHA-256 digest proves legal authenticity or admissibility.

## 2. Goals

BE-004 must provide:

1. private file upload for authenticated users,
2. server-side ownership enforcement for every file operation,
3. explicit file type and size validation,
4. SHA-256 integrity fingerprinting calculated by the server over the stored payload,
5. production S3-compatible storage and local-development storage through one adapter interface,
6. short-lived download authorization,
7. immediate application-level revocation on deletion request,
8. physical-object deletion with bounded retry/reconciliation state,
9. cross-user non-disclosure behavior where missing and unauthorized resources are indistinguishable,
10. deterministic automated tests for the security invariants above.

## 3. Non-goals

The task does not include:

- public bucket or public-object access,
- direct browser-to-S3 upload,
- multipart/resumable upload,
- OCR or content classification,
- malware scanning service integration,
- legal evidence scoring, authenticity judgment, admissibility prediction, or legal-effect claims,
- permanent download URLs,
- medical/health dispute workflows,
- case packet generation or export ZIP generation,
- automatic PDF redaction.

Those concerns require later tasks or production integrations.

## 4. Chosen architecture

### 4.1 Storage adapter

Introduce a server-only `EvidenceStorage` interface with two implementations:

- `LocalEvidenceStorage` for local development/test,
- `S3EvidenceStorage` for production-like private object storage.

The application layer depends only on the interface. Storage-driver selection is performed from validated server environment values.

The adapter surface is intentionally small:

```ts
export interface EvidenceStorage {
  putObject(input: PutEvidenceObjectInput): Promise<void>;
  deleteObject(storageKey: string): Promise<void>;
  createDownloadUrl(input: DownloadUrlInput): Promise<string>;
}
```

`putObject` accepts bytes, MIME type, and a server-generated storage key. `deleteObject` is idempotent from the application point of view: deleting an already absent object is treated as success when the storage provider reports a not-found condition. `createDownloadUrl` must never return a public/permanent URL.

### 4.2 Upload strategy

For the MVP, the browser uploads the file to a protected Next.js route. The server validates and reads the payload, calculates SHA-256 over the exact bytes it stores, then calls the storage adapter.

The 20 MiB product limit keeps this path bounded enough for the MVP and avoids trusting a browser-supplied checksum. Direct presigned browser uploads are explicitly deferred.

### 4.3 Object keys

Object keys are generated only by the server and never include raw user filenames. A recommended shape is:

```text
users/<ownerUserId>/vault-items/<vaultItemId>/<randomUuid>
```

The key may include an extension derived from an allowed MIME type, but the original filename is stored only as metadata. User-controlled path fragments are never concatenated into the storage key.

## 5. Storage configuration

The existing environment contract remains the source of truth:

```text
STORAGE_DRIVER=local|s3
LOCAL_STORAGE_PATH=.data/evidence
S3_ENDPOINT=
S3_REGION=ap-northeast-2
S3_BUCKET=
S3_ACCESS_KEY_ID=
S3_SECRET_ACCESS_KEY=
S3_FORCE_PATH_STYLE=false
```

Rules:

- `local` is allowed for local development/test only.
- `s3` requires bucket, region, access key, and secret key.
- custom endpoint is optional for S3-compatible providers.
- production configuration must reject `STORAGE_DRIVER=local`.
- no credential may be exposed to client bundles, JSON responses, browser storage, or logs.
- Korea-region storage is preferred operationally; the code validates configuration but does not fabricate a claim that a production bucket exists.

## 6. Accepted file contract

Allowed MIME types:

- `application/pdf`
- `image/jpeg`
- `image/png`
- `image/webp`

Maximum payload size:

- 20 MiB = 20 × 1024 × 1024 bytes

Validation requirements:

- reject empty files,
- reject files above 20 MiB,
- reject unsupported MIME types,
- normalize the original filename for display/storage metadata length but do not use it as a path,
- reject upload if the referenced VaultItem is not owned by the authenticated user,
- reject an `evidenceEventId` unless the event belongs to the same owned VaultItem.

The API does not claim that MIME type proves content authenticity. Content-sniffing and malware scanning are separate production hardening concerns.

## 7. Integrity fingerprint

The server calculates SHA-256 from the exact byte sequence passed to storage and persists the lowercase 64-character hex digest in `evidenceFiles.sha256`.

The fingerprint is described only as an integrity comparison value. Product/API copy must not call it:

- proof of authenticity,
- legal timestamp,
- admissibility proof,
- proof that a file was not manipulated before upload,
- guarantee of legal effect.

A future download-integrity verifier may compare downloaded bytes to this hash, but BE-004 does not make legal conclusions from the result.

## 8. Upload transaction flow

Protected endpoint:

```text
POST /api/vault-items/[id]/evidence-files
```

Input: `multipart/form-data`

Expected fields:

- `file` — required File,
- `evidenceEventId` — optional UUID,
- `redactionState` — optional, constrained to allowed server values when introduced.

Flow:

1. resolve `ev_session` on the server,
2. derive `ownerUserId` from the authenticated session,
3. load the VaultItem with owner scope,
4. if supplied, load the Evidence Event under the same owned VaultItem,
5. validate file size/type/name,
6. read bytes,
7. calculate SHA-256,
8. generate server storage key,
9. write private object,
10. create `evidenceFiles` metadata row,
11. return a DTO that excludes storage credentials and permanent object URLs.

If object write succeeds but metadata creation fails, the service immediately attempts compensating object deletion. If compensating deletion fails, it records a deletion/reconciliation job so the orphan object is not silently abandoned.

## 9. Download authorization flow

Protected endpoint:

```text
POST /api/evidence-files/[id]/download
```

Flow:

1. resolve authenticated user,
2. query `evidenceFiles` using both file id and `ownerUserId`, excluding `deletedAt` rows,
3. return the same `404 {"error":"not_found"}` for missing, deleted, and cross-user files,
4. ask storage adapter for a short-lived download URL,
5. return `{ url, expiresAt }` with `Cache-Control: no-store`.

Production S3 download URL TTL is exactly 300 seconds.

A generated signed URL:

- is not persisted in the database,
- is not written to application logs,
- is not included in analytics,
- is not reusable after provider expiry,
- is issued only after ownership verification.

For local development, the adapter may issue an application-owned short-lived signed content URL rather than a filesystem path. Local absolute paths must never be returned to the browser.

## 10. Delete and reconciliation flow

Protected endpoint:

```text
DELETE /api/evidence-files/[id]
```

Deletion has two distinct phases.

### Phase A — immediate application revocation

Within the database transaction/service boundary:

1. verify file ownership,
2. set `evidenceFiles.deletedAt` if not already set,
3. create or ensure one active deletion job for the object.

After this point, all application reads and signed-download issuance exclude the file immediately.

### Phase B — physical object deletion

A deletion worker/service processes the job:

1. call `storage.deleteObject(storageKey)`,
2. treat storage not-found as successful reconciliation,
3. mark job `completed` on success,
4. on transient/provider failure, increment `attempts` and store a bounded normalized `lastErrorCode`,
5. keep the job retryable until the configured bounded retry policy is exhausted,
6. after bounded retries, keep the job visibly failed/blocked for Debug / Problem Router or operator action; never mark it complete without evidence.

The user-facing API must never report physical deletion complete merely because the metadata was hidden.

## 11. Reconciliation policy

BE-004 uses a bounded retry policy, for example:

- maximum automatic attempts: 5,
- retry eligibility determined by normalized storage error category,
- permanent configuration/auth failures become blocked immediately,
- not-found is terminal success,
- transient network/5xx errors remain retryable.

The exact backoff scheduler is infrastructure-dependent and may be invoked by a later worker/cron integration. BE-004 must still expose a deterministic `processDeletionJob` service that can be unit tested and safely called repeatedly.

## 12. Redaction handling

A redacted derivative is a separate private object and a separate evidence-file metadata row. It is never an in-place overwrite of the original object.

Rules:

- client-side redacted images must be permanently rasterized before upload,
- MVP PDFs must be pre-redacted before upload,
- the server records redaction state but does not claim the content is safely redacted merely from a client flag,
- the original file remains private unless the user separately deletes it,
- signed URLs preserve the same ownership checks for both original and redacted files.

## 13. Data model changes

The existing `evidenceFiles` table already contains the core fields required by BE-004. The implementation may add only fields necessary for reliable deletion/reconciliation or redacted-derivative linkage if tests prove they are required.

The existing `deletionJobs` table is reused for object deletion state. If uniqueness is required to prevent duplicate active jobs, add an explicit migration rather than relying on application convention alone.

No signed URL, S3 credential, bearer token, raw session token, or provider error body is stored in either table.

## 14. Repository/service boundaries

Recommended server-only modules:

```text
src/storage/config.ts
src/storage/types.ts
src/storage/key.ts
src/storage/local-storage.ts
src/storage/s3-storage.ts
src/storage/storage-factory.ts
src/storage/errors.ts
src/services/evidence-file-service.ts
src/services/deletion-reconciliation.ts
src/repositories/evidence-repository.ts
src/repositories/deletion-job-repository.ts
```

Route handlers should remain thin and delegate validation/business/storage behavior to services.

The service layer owns:

- validation orchestration,
- hash calculation,
- storage-key generation,
- compensation logic,
- deletion-state transitions,
- DTO shaping.

Repositories own database persistence and owner-scoped queries only.

## 15. API error contract

Protected evidence APIs use normalized local errors only:

```json
{"error":"unauthorized"}
{"error":"not_found"}
{"error":"invalid_request"}
{"error":"unsupported_file_type"}
{"error":"file_too_large"}
{"error":"storage_unavailable"}
```

Requirements:

- no raw AWS/S3 error body,
- no bucket name or storage key in user-facing error detail,
- no distinction between foreign-owner and missing file,
- no stack trace in response,
- protected responses use `Cache-Control: no-store`.

## 16. Security invariants

The following findings are blockers:

- cross-user file metadata, download URL, object bytes, delete ability, or existence disclosure,
- public ACL/bucket behavior,
- permanent object URLs,
- storage key created from unsanitized user path input,
- signed URL issued before owner verification,
- signed URL TTL above 5 minutes for production evidence downloads,
- storage credentials in browser/client code,
- deleted metadata still able to obtain a signed URL,
- deletion job marked successful when the provider deletion actually failed,
- object-write success followed by DB-write failure without compensation/reconciliation,
- SHA-256 described as legal authenticity/effect proof.

## 17. Test strategy

Implementation follows RED → GREEN TDD. At minimum add automated tests for:

### Configuration

- valid local development config,
- valid S3 config,
- production rejects local driver,
- missing required S3 secrets fail closed.

### File validation / integrity

- allowed MIME types accepted,
- unsupported type rejected,
- 20 MiB boundary accepted,
- above-limit rejected,
- empty file rejected,
- SHA-256 matches known fixture bytes,
- storage key excludes raw filename/path traversal input.

### Upload service

- owned VaultItem upload succeeds,
- foreign VaultItem returns not-found,
- foreign/mismatched Evidence Event rejected,
- object write failure creates no metadata,
- metadata write failure triggers object compensation,
- failed compensation creates reconciliation job.

### Download

- owned active file gets short-lived URL,
- foreign, missing, and deleted file return identical not-found contract,
- production signer uses 300-second TTL,
- response does not expose storage key/credentials.

### Delete/reconcile

- delete immediately prevents future download,
- physical delete success completes job,
- provider not-found completes job,
- transient error increments attempts and remains retryable,
- permanent error becomes blocked,
- exhausted retry budget never becomes completed,
- repeated processor execution is idempotent.

### Cross-user regression

- user A cannot read metadata for user B file,
- user A cannot receive a signed URL for user B file,
- user A cannot delete user B file,
- user A cannot infer whether a guessed user B file id exists from response status/body.

### Final verification

- `pnpm install --frozen-lockfile`
- `pnpm test:run`
- `pnpm build`

Real S3, real PostgreSQL migration, browser, deployment, and production bucket-policy checks are reported PASS only when actually executed against those environments.

## 18. Completion criteria

BE-004 writer implementation is complete only when:

- the branch contains the approved storage boundary,
- RED/GREEN evidence is recorded,
- final branch HEAD passes frozen install, full tests, and production build,
- an Agent PR targets `develop`,
- PR head SHA agrees with the verified SHA,
- no production readiness claim is made for real S3/PostgreSQL/browser/deployment checks that were not executed,
- independent release-chain Code Review / Reviewer / QA remain separate later gates.
