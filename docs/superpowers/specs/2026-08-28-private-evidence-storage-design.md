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
6. short-lived production S3 download authorization,
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
export type EvidenceDownloadTarget =
  | {
      kind: "bytes";
      bytes: Uint8Array;
    }
  | {
      kind: "redirect";
      url: string;
      expiresAt: Date;
    };

export interface EvidenceStorage {
  putObject(input: PutEvidenceObjectInput): Promise<void>;
  deleteObject(storageKey: string): Promise<void>;
  createDownloadTarget(input: DownloadTargetInput): Promise<EvidenceDownloadTarget>;
}
```

`putObject` accepts bytes, MIME type, and a server-generated storage key. `deleteObject` is idempotent from the application point of view: deleting an already absent object is treated as success when the storage provider reports a not-found condition.

For local development, `createDownloadTarget` returns bytes and the protected application route streams them. For S3-compatible storage, it returns a private signed redirect target with a 300-second expiry.

### 4.2 Upload strategy

For the MVP, the browser uploads the file to a protected Next.js route. The server validates and reads the payload, calculates SHA-256 over the exact bytes it stores, then calls the storage adapter.

The 20 MiB product limit keeps this path bounded enough for the MVP and avoids trusting a browser-supplied checksum. Direct presigned browser uploads are explicitly deferred.

### 4.3 Object identity and key

The service generates the Evidence File UUID before writing the object. The storage key is deterministic from server-owned identifiers only:

```text
users/<ownerUserId>/evidence/<evidenceFileId>
```

The raw filename, MIME type, extension, VaultItem title, merchant name, and any other user-controlled string never appear in the storage key.

This deterministic key is required for reconciliation: if object storage succeeds but the evidence metadata insert fails, a deletion job containing `userId` and the generated `evidenceFileId` can reconstruct the orphan object's storage key without relying on a metadata row that does not exist.

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

- `local` is allowed for development/test only.
- production rejects `STORAGE_DRIVER=local`.
- `s3` requires bucket, region, access key, and secret key.
- custom endpoint is optional for S3-compatible providers.
- S3 objects are written without public ACL configuration.
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
- normalize the original filename for display metadata and enforce the database's 255-character limit,
- never use the filename as a path,
- reject upload if the referenced VaultItem is not owned by the authenticated user,
- reject an `evidenceEventId` unless the event belongs to the same owned VaultItem.

The API does not claim that MIME type proves content authenticity. Content-sniffing and malware scanning are separate production-hardening concerns.

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
- `evidenceEventId` — optional UUID.

`redactionState` is not accepted from this public route. New uploads use the server-side default `unreviewed`. A later explicit redacted-derivative service may set a different state after its own contract is implemented.

Flow:

1. resolve `ev_session` on the server,
2. derive `ownerUserId` from the authenticated session,
3. load the VaultItem with owner scope,
4. if supplied, load the Evidence Event under the same owned VaultItem,
5. validate file size/type/name,
6. read bytes,
7. calculate SHA-256,
8. generate `evidenceFileId`,
9. derive the deterministic private storage key,
10. write the private object,
11. create `evidenceFiles` metadata using the same generated ID and storage key,
12. return a DTO that excludes storage key, credentials, provider details, and permanent object URLs.

If object write succeeds but metadata creation fails, the service immediately attempts compensating object deletion. If compensation also fails, it creates a deletion job with:

- `userId = ownerUserId`,
- `kind = evidence_file_object`,
- `targetId = evidenceFileId`,
- `status = queued`.

The worker can derive the orphan storage key from `userId + targetId`.

## 9. Download authorization flow

Protected endpoint:

```text
GET /api/evidence-files/[id]/download
```

Flow:

1. resolve authenticated user,
2. query `evidenceFiles` using both file ID and `ownerUserId`, excluding `deletedAt` rows,
3. return the same `404 {"error":"not_found"}` for missing, deleted, and cross-user files,
4. ask storage for a download target,
5. local driver: stream bytes through the already authenticated route,
6. S3 driver: return a temporary HTTP redirect to the 300-second signed private URL.

All route responses set `Cache-Control: no-store`.

For streamed local responses, use the stored MIME type and a safe `Content-Disposition: attachment` filename derived from metadata. Local absolute filesystem paths are never returned.

For S3-compatible storage:

- signed download TTL is exactly 300 seconds,
- signed URL is generated only after ownership verification,
- signed URL is never persisted in the database,
- signed URL is never intentionally written to application logs or analytics,
- bucket/object is not made public to support download.

## 10. Delete and reconciliation flow

Protected endpoint:

```text
DELETE /api/evidence-files/[id]
```

Deletion has two phases.

### Phase A — immediate application revocation

Within the database transaction/service boundary:

1. verify file ownership,
2. set `evidenceFiles.deletedAt` if not already set,
3. create or ensure one active deletion job with `kind = evidence_file_object` and `targetId = evidenceFileId`.

After this point, all application reads and download issuance exclude the file immediately.

The DELETE API reports that deletion was accepted/queued. It does not report that physical object destruction is complete.

### Phase B — physical object deletion

A deterministic deletion worker/service processes the job:

1. derive storage key from `userId + targetId`,
2. call `storage.deleteObject(storageKey)`,
3. treat provider/object not-found as successful reconciliation,
4. mark job `completed` on confirmed success/not-found,
5. on retryable provider/network failure, increment `attempts`, set `status = queued`, and persist a normalized bounded `lastErrorCode`,
6. on permanent configuration/auth failure, increment `attempts` and set `status = blocked`,
7. when a retryable failure reaches attempt 5, set `status = blocked`,
8. never mark a job `completed` merely because the retry budget was exhausted.

## 11. Reconciliation policy

Automatic retry policy is fixed for BE-004:

- maximum provider deletion attempts: 5,
- `not_found` → terminal success,
- retryable network/timeout/provider-5xx → queued until attempt 5, then blocked,
- invalid configuration/credentials/authorization → blocked immediately after the failed attempt,
- blocked jobs require Debug / Problem Router or operator recovery,
- processing an already `completed` job is a no-op,
- processing a `blocked` job is a no-op unless a later explicit recovery action requeues it.

The exact scheduler/backoff trigger is infrastructure-dependent and is not added here. BE-004 exposes a deterministic `processDeletionJob` service that can be called repeatedly and tested in isolation.

## 12. Redaction handling

A redacted derivative is a separate private object and a separate evidence-file metadata row. It is never an in-place overwrite of the original object.

Rules:

- client-side redacted images must be permanently rasterized before upload by the later frontend redaction flow,
- MVP PDFs must be pre-redacted before upload,
- this public BE-004 upload route always records `unreviewed`,
- the server must not claim a file is safely redacted merely from client input,
- the original remains private unless separately deleted,
- original and redacted derivatives use the same ownership/download/deletion rules.

## 13. Data model changes

The existing `evidenceFiles` table already contains the core fields required by BE-004 and supports an application-generated UUID supplied during insert.

The existing `deletionJobs` table is reused with:

- `kind = evidence_file_object`,
- `targetId = evidenceFileId`,
- `userId = ownerUserId`,
- statuses `queued`, `completed`, or `blocked` for this task.

If tests show duplicate active jobs are possible under concurrent deletion requests, add a database migration that enforces the chosen idempotency key. Do not silently depend on process-local locking.

No signed URL, S3 credential, bearer token, raw session token, raw provider error, or filesystem absolute path is stored in these tables.

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

Route handlers remain thin and delegate validation/business/storage behavior to services.

The service layer owns:

- validation orchestration,
- hash calculation,
- Evidence File ID and storage-key generation,
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

- cross-user file metadata, download target, object bytes, delete ability, or existence disclosure,
- public ACL/bucket behavior,
- permanent object URLs,
- storage key created from user-controlled path input,
- signed URL issued before owner verification,
- S3 signed URL TTL above 300 seconds,
- storage credentials in browser/client code,
- deleted metadata still able to obtain object bytes or a signed URL,
- deletion job marked successful when provider deletion actually failed,
- object-write success followed by metadata-write failure without compensation/reconciliation,
- orphan object that cannot be deterministically targeted by a queued deletion job,
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
- storage key is exactly derived from owner ID + Evidence File ID and excludes filename/path traversal input.

### Upload service

- owned VaultItem upload succeeds,
- foreign VaultItem returns not-found,
- foreign/mismatched Evidence Event rejected,
- public upload input cannot set trusted redaction state,
- object write failure creates no metadata,
- metadata write failure triggers object compensation,
- failed compensation creates a derivable reconciliation job.

### Download

- owned active local file streams bytes,
- owned active S3 file redirects only after owner check,
- foreign, missing, and deleted file return identical not-found contract,
- production signer uses exactly 300-second TTL,
- response does not expose storage key/credentials/filesystem path.

### Delete/reconcile

- delete immediately prevents future download,
- physical delete success completes job,
- provider not-found completes job,
- transient error increments attempts and remains queued before attempt 5,
- attempt-5 transient failure becomes blocked,
- permanent error becomes blocked immediately,
- exhausted retry budget never becomes completed,
- completed/blocked processor execution is idempotent.

### Cross-user regression

- user A cannot read metadata for user B file,
- user A cannot receive/trigger a download target for user B file,
- user A cannot delete user B file,
- user A cannot infer whether a guessed user B file ID exists from response status/body.

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
