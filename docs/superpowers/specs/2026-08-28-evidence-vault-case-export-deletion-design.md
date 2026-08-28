# Evidence Vault Case, Export, and Deletion Reconciliation Design

Date: 2026-08-28
Owner: Backend Agent / Team 해바라기
Task: BE-005
Branch: `agent/해바라기/backend/case-export-deletion`
Depends on: BE-003, BE-004

## Goal

Implement the owner-scoped backend required for dispute-preparation mode, deterministic evidence-packet export, export-object lifecycle, and truthful account/data deletion behavior.

The feature organizes user-provided facts and files. It does not assess legal entitlement, liability, admissibility, authenticity, refund probability, or expected dispute outcome.

## Chosen architecture

Use four bounded layers:

1. **Case repository/service** — owner-scoped case CRUD and evidence linking.
2. **Deterministic preparation projection** — factual chronology + neutral checklist definitions; no AI/OCR/legal scoring.
3. **Synchronous MVP export service** — generate the packet inside the request while persisting explicit generation status so a later worker can replace the execution model without changing the API contract.
4. **Generalized deletion reconciliation** — extend the existing evidence-object deletion job mechanism to export objects and account-wide deletion requests.

Rejected alternatives:

- new queue/worker infrastructure for export generation — unnecessary operational scope for the MVP,
- generating exports by fetching the application's own signed download URLs — creates avoidable HTTP/auth/storage coupling and URL exposure inside the server,
- public/permanent export URLs — violates the private-by-default storage contract,
- AI-generated summaries/checklists — outside approved product/legal scope,
- deleting the user row immediately — would destroy reconciliation metadata before private objects are confirmed deleted.

## Case model

The existing `ev_cases` table remains the primary case record.

Supported MVP `caseType` values:

- `refund`,
- `return`,
- `cancellation`,
- `other`.

These are organizational labels only and do not encode legal conclusions.

### Open-case rule

Allow at most one `open` case per VaultItem at a time. Historical closed cases may remain.

Enforce the rule with a database-level partial unique index on `vault_item_id` where `status = 'open'`, in addition to service-level conflict handling.

### Case evidence link purpose

Extend `ev_case_evidence_links` with:

- `purpose` varchar(40), required, default `other`.

Allowed purpose values:

- `transaction_record`,
- `communication`,
- `condition_record`,
- `request_record`,
- `other`.

The purpose is selected by the user/UI when linking evidence. Evidence Vault does not infer purpose from file contents.

The existing `(case_id, evidence_file_id)` primary key remains; one evidence file appears once in a case and has one current organizational purpose.

## Case API

### `GET /api/cases`

Returns only caller-owned cases, newest open cases first, then closed cases. No cross-user IDs or owner identifiers are exposed.

### `POST /api/vault-items/[id]/cases`

Body:

```json
{
  "caseType": "refund",
  "userSummary": "사용자가 직접 적은 사실 요약"
}
```

`userSummary` is optional and factual/free-text. The server never rewrites it into a legal conclusion.

Rules:

- parent VaultItem must belong to authenticated user,
- archived/nonexistent/cross-user VaultItem → normalized `404 not_found`,
- existing open case for the VaultItem → `409 conflict`,
- request owner/user IDs are not accepted as authority.

### `GET /api/cases/[id]`

Returns one owner-scoped case detail including:

- case metadata,
- parent VaultItem factual metadata required for preparation,
- linked evidence metadata and user-selected purpose,
- neutral checklist projection,
- chronological event projection from the same owned VaultItem.

### `PATCH /api/cases/[id]`

Allows only:

- `caseType`,
- `userSummary` nullable,
- `status` transition `open → closed` or `closed → open` only when the one-open-case invariant remains satisfied.

### Case evidence links

Use explicit nested routes:

- `POST /api/cases/[id]/evidence-links`
- `PATCH /api/cases/[id]/evidence-links/[evidenceFileId]`
- `DELETE /api/cases/[id]/evidence-links/[evidenceFileId]`

Create body:

```json
{
  "evidenceFileId": "uuid",
  "purpose": "communication"
}
```

The server verifies in SQL/service boundaries that:

- case belongs to caller,
- evidence file belongs to caller,
- evidence file belongs to the same VaultItem as the case,
- evidence file is not soft-deleted.

Cross-user/mismatched resources normalize to `404 not_found` without existence disclosure.

## Neutral preparation checklist

Checklist definitions are deterministic repository-owned copy, not stored legal rules.

Keys:

- `transaction_record` — `거래 사실을 보여주는 자료`,
- `communication` — `상대방과 주고받은 내용`,
- `condition_record` — `문제 상태를 보여주는 사진이나 문서`,
- `request_record` — `환불·반품·해지 등을 요청한 기록`.

For each key, the projection reports the count of currently linked, nondeleted evidence files that the user assigned to that purpose.

A zero count is presented only as an organizational gap, for example `아직 연결하지 않은 자료가 있어요.` It must not be interpreted or labeled as:

- legally required,
- evidence insufficient,
- case weak/strong,
- refund likely,
- admissible/authentic,
- win probability.

`other` linked evidence is shown separately and does not satisfy one of the four checklist keys.

## Chronology projection

Chronology uses only caller-owned Evidence Events from the case's VaultItem, sorted by:

1. `occurredOn` ascending,
2. `createdAt` ascending.

The projection preserves user-entered title/note. It may add stable factual labels for event type but does not summarize or reinterpret facts.

## Private raw-object read extension

The existing `EvidenceStorage` interface supports put/delete/download-target but not internal raw reads. Export generation must not obtain evidence bytes by issuing a signed URL and performing a second HTTP request.

Extend the storage contract with a server-only method equivalent to:

```ts
readObject(storageKey: string): Promise<Uint8Array>;
```

Implement it for both local and S3-compatible adapters.

Rules:

- `readObject` is never exposed directly by an HTTP route,
- server services obtain `storageKey` only after owner-scoped metadata verification,
- provider errors are normalized through the existing storage error layer,
- no permanent public object URL is introduced.

## Export request contract

### `POST /api/cases/[id]/exports`

Body:

```json
{
  "eventIds": ["uuid"],
  "evidenceFileIds": ["uuid"]
}
```

The user explicitly controls inclusion for review/privacy.

Validation:

- case belongs to caller,
- selected events belong to the case's VaultItem,
- selected evidence files are caller-owned, belong to the same VaultItem, are linked to the case, and are not deleted,
- duplicate event/evidence IDs are rejected with `422 validation_failed`,
- maximum 100 selected evidence files,
- total selected evidence bytes must not exceed 200 MiB for synchronous MVP generation.

The limits protect request memory/runtime and are not claims about provider storage capacity.

### Export lifetime configuration

The packet retention/access TTL is server-owned configuration:

```ts
type ExportConfig = {
  packetTtlSeconds: number;
};
```

Production configuration must provide a positive bounded value. Clients cannot select expiration. Tests inject explicit values. Missing/invalid production configuration yields a normalized `internal_error`; this task does not invent a retention duration on behalf of the operator.

### Status lifecycle

Persist the export row before generation using:

```text
generating → ready
generating → failed
ready → deleting → deleted
ready → expired → deleted
```

The existing `queued` default is migrated/aligned so newly generated synchronous exports use `generating`. Any legacy `queued` row is treated as not-ready and never downloadable.

Add export metadata needed for truthful lifecycle reporting:

- `failure_code` varchar(80), nullable,
- `byte_size` bigint, nullable,
- `deleted_at` timestamptz, nullable,
- `updated_at` timestamptz.

`storage_key` remains private server data and is never returned in API DTOs.

## Packet contents

The generated ZIP contains exactly these top-level entries:

```text
summary.pdf
manifest.json
evidence/*
```

### `summary.pdf`

Contains deterministic factual sections only:

- VaultItem title/category,
- merchant/service name when present,
- purchase/start date,
- amount/currency when present,
- user-written case summary when present,
- selected chronological events,
- list of included evidence filenames,
- product disclaimer.

Required disclaimer:

`증빙함은 사용자가 입력한 사실과 첨부 자료를 정리하는 도구입니다. 개별 사건에 대한 법률 판단, 법률상담 또는 법률대리를 제공하지 않습니다.`

Do not add legal conclusions, success estimates, authenticity/admissibility claims, or generated facts.

### `manifest.json`

Canonical UTF-8 JSON with deterministic key ordering. Include:

- packet format version,
- generated timestamp,
- case ID and case type,
- VaultItem factual fields needed to identify the record,
- selected event IDs/dates/types/titles,
- selected evidence file IDs, sanitized filenames, MIME types, byte sizes, and existing per-file SHA-256 values.

Exclude:

- storage keys,
- user/owner IDs,
- Bouquet subject/token/session values,
- deleted evidence,
- provider URLs.

`manifest_hash` stored in `ev_export_packets` is SHA-256 of the exact `manifest.json` bytes placed into the ZIP. It is described only as an integrity fingerprint of that manifest, not proof of authenticity or legal effect.

### Evidence filenames

Archive paths must be collision-safe and traversal-safe. Normalize to a deterministic form such as:

```text
evidence/001-<sanitized-filename>
```

Remove path separators/control characters and preserve a safe extension where possible.

## Export storage and generation

Use a private deterministic object key derived from authenticated owner and export ID, for example:

```text
users/<ownerUserId>/exports/<exportId>.zip
```

The exact prefix belongs to a central key builder, not route code.

Generation sequence:

1. validate owner/case/selection,
2. insert `generating` export row,
3. read selected evidence bytes server-side,
4. create `summary.pdf` and canonical `manifest.json`,
5. assemble ZIP,
6. compute manifest hash and total ZIP byte size,
7. put private export object,
8. mark export `ready`, set generated/expires/hash/byte-size metadata.

If generation fails before storage write, mark `failed` with a normalized code.

If storage write succeeds but final metadata persistence fails:

1. mark/leave the export nondownloadable (`failed`),
2. enqueue an idempotent `export_packet_object` deletion job,
3. return a stable failure.

The service must not intentionally leave an untracked permanent object.

## Export retrieval/download

### `GET /api/exports/[id]`

Owner-scoped status DTO only. Return:

- id,
- caseId,
- status,
- generatedAt,
- expiresAt,
- manifestHash,
- byteSize,
- normalized failure state when applicable.

Do not return storage key or provider URL.

Before returning a `ready` row, compare `expiresAt` with server time. If expired:

1. atomically transition `ready → expired`,
2. set `deletedAt = now` as the deletion-request timestamp,
3. enqueue idempotent `export_packet_object` deletion,
4. return the DTO as `status: expired`.

### `GET /api/exports/[id]/download`

Rules:

- authenticated owner only,
- only `ready` and unexpired/nondeleted packets may download,
- obtain a storage download target with `expiresInSeconds: 300`,
- local adapter may stream bytes; S3 adapter may redirect to a 5-minute signed URL,
- `Cache-Control: no-store`,
- cross-user/missing/deleting/deleted → normalized `404`,
- expired detection performs the same `ready → expired` + deletion-job transition and returns `410 { "error": "export_expired" }`.

A previously issued 5-minute provider-signed URL may remain usable until its own TTL expires; Evidence Vault does not claim it can revoke a URL already issued by the provider.

## Export deletion

### `DELETE /api/exports/[id]`

Owner-scoped behavior:

1. immediately make the packet unavailable by setting `deletedAt = now` and `status = deleting`,
2. enqueue idempotent deletion job `kind = export_packet_object`,
3. return `202 { "status": "accepted" }`.

Deletion reconciliation treats storage `not_found` as successful completion.

On export-object deletion success:

- set export `status = deleted`,
- set `storageKey = null`,
- clear `failureCode`,
- retain only the export row's non-storage lifecycle metadata (`id`, `caseId`, generated/expiry timestamps, manifestHash, byteSize, deletedAt, status) until normal database/account deletion removes it.

The packet is nondownloadable from the initial `deleting`/`expired` transition onward.

## Generalized deletion reconciliation

Extend the existing job processor to support:

- `evidence_file_object`,
- `export_packet_object`.

Use kind-specific target resolvers rather than route-specific deletion logic.

Retry policy remains bounded:

- transient storage failure → queued with incremented attempts,
- not found → completed,
- permanent failure or attempts >= 5 → blocked,
- unsupported kind → blocked with stable code.

The worker/service never marks a deletion completed before object deletion/not-found is observed.

For an export job, successful object deletion also performs the export lifecycle update described above.

## Account deletion backend

Add `DELETE /api/account` as the backend contract consumed later by FE-003.

Authenticated sequence:

1. in one database transaction mark `ev_users.deleted_at = now`,
2. revoke all active Evidence Vault sessions for that user,
3. enumerate all nondeleted evidence objects and all nondeleted export objects owned through the user's VaultItems/cases,
4. make application routes inaccessible immediately through the soft-deleted user/session boundary,
5. create/reuse idempotent deletion jobs for every private object,
6. return `202 { "status": "accepted" }`.

Because `findActiveSessionByHash` already requires `users.deleted_at IS NULL`, setting `deleted_at` makes existing Evidence Vault sessions unusable immediately. Explicit session revocation remains required defense-in-depth/cleanup.

Previously issued provider-signed evidence/export URLs may remain valid only for their already-bounded TTL; account deletion does not claim provider URL revocation.

Do not hard-delete the user row while object deletion jobs are queued or blocked.

### Final account cleanup

There is no public account-deletion status endpoint in MVP.

Add an internal service equivalent to:

```ts
maybeFinalizeDeletedAccount(userId): Promise<boolean>
```

It runs after account deletion is queued and after each deletion job for that user reaches `completed`.

Finalization rules:

- user must already have `deletedAt`,
- no required evidence/export deletion job may be `queued` or `blocked`,
- every private object associated with the user must have a completed/not-found deletion outcome,
- when these conditions are true, hard-delete the user row so FK cascades remove remaining application metadata, sessions, VaultItems, cases, export rows, acceptance rows, and deletion-job rows,
- if the user has zero private objects, finalization may hard-delete immediately after the soft-delete transaction completes,
- if any job is blocked, finalization returns false and retains the soft-deleted account for operator recovery; it must not report completion.

No user-facing message may claim all data is destroyed based only on the initial `202` response.

BE-005 does not invent an email/status notification channel.

## Migration strategy

BE-005 implementation must begin from the latest `develop` after earlier Backend work is integrated and allocate the **next available migration number**. It must never renumber existing migrations.

Expected schema changes include:

- one-open-case partial unique index,
- `case_evidence_links.purpose`,
- export lifecycle columns,
- indexes required for owner/status/deletion-reconciliation queries.

The committed migration sequence must be applied to a PostgreSQL 16 CI container before tests/build are considered green.

## Security and privacy gates

Objective blockers:

- cross-user case/export access,
- linking evidence from another owner or another VaultItem,
- accepting request-supplied owner IDs as authority,
- export containing unselected/deleted/unlinked evidence,
- storage key/provider URL in ordinary API DTOs,
- permanent/public export URL,
- server export generation using public/signed HTTP round-trip instead of internal object read,
- manifest/summary containing session/Bouquet/storage secrets,
- account deletion that leaves application session access active after request acceptance,
- hard-deleting account metadata before private-object reconciliation permits finalization,
- reporting deletion completed while object jobs are queued/blocked,
- legal/authenticity/admissibility/success claims.

## Testing strategy

Implementation follows RED → observed RED → minimal GREEN → full GREEN.

Required automated coverage:

1. owner-scoped case create/list/get/update/close,
2. one-open-case conflict and database constraint,
3. cross-user case access normalizes to not_found,
4. evidence linking rejects cross-user/cross-vault/deleted files,
5. checklist counts only user-selected link purposes,
6. chronology includes only same owned VaultItem events in deterministic order,
7. storage adapters implement server-only raw read,
8. export selection rejects duplicate/unowned/unlinked/deleted resources,
9. selection count/byte limits are enforced,
10. packet contains `summary.pdf`, `manifest.json`, `evidence/*` only at top level,
11. manifest hash matches exact manifest bytes,
12. ZIP path sanitization prevents traversal/collisions,
13. summary/manifest exclude secrets/storage keys and legal conclusions,
14. storage-write/metadata-failure queues orphan export deletion,
15. export GET/download/delete are owner-scoped,
16. download target TTL is 300 seconds,
17. expired packet transitions to `expired`, becomes nondownloadable, and queues deletion,
18. explicit export delete denies access immediately and reconciles object deletion,
19. deletion processor supports evidence and export kinds with bounded retry/not-found completion,
20. account deletion marks user deleted before response, revokes sessions, and queues all private objects idempotently,
21. account finalization hard-deletes only after all required jobs complete and refuses blocked/queued state,
22. complete PostgreSQL migration, unit suite, production build pass.

A real production bucket/deployed download and final production account-erasure operation are not claimed until later deployment/QA evidence performs them.

## Explicit non-goals

- no AI/OCR/legal analysis,
- no legal-advice chatbot,
- no public sharing links,
- no email notification system,
- no external queue infrastructure,
- no payment/billing,
- no medical/health workflow,
- no claim that SHA-256 proves authenticity/admissibility,
- no frontend case/export/privacy UI.

## Acceptance criteria

BE-005 is ready for integration when:

- cases and evidence links are owner scoped and neutral,
- preparation projection is deterministic and non-legal,
- export packet bytes are generated from verified private evidence through internal storage reads,
- generated packet structure/hash/download/expiry lifecycle matches this contract,
- export/evidence deletion reconciliation is idempotent and bounded,
- account deletion immediately removes application-session access and queues all private-object destruction,
- final hard deletion occurs only after reconciliation evidence supports it,
- PostgreSQL migration, full tests, and production build are green,
- real production storage/deployment checks not performed remain explicitly unclaimed.
