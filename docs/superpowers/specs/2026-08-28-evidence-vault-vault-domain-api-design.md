# Evidence Vault Vault Domain API Design

Date: 2026-08-28
Owner: Backend Agent / Team 해바라기
Task: BE-003
Branch: `agent/해바라기/backend/vault-domain-api`
Depends on: BE-001

## Goal

Provide the owner-scoped HTTP API contract that FE-001 can use for the Evidence Vault dashboard and VaultItem CRUD, including recorded deadlines and factual timeline events, without exposing client-supplied ownership identifiers or fabricating dashboard data.

BE-003 is the backend domain/API layer only. Private evidence-file storage remains BE-004. Attachment upload/download, case preparation, export generation, onboarding acknowledgements, guide content, and account deletion remain outside this task.

## Chosen architecture

Use explicit Next.js App Router resource Route Handlers backed by owner-scoped repositories and existing Zod domain schemas.

Chosen public API surface:

```text
GET    /api/dashboard
GET    /api/vault-items
POST   /api/vault-items
GET    /api/vault-items/[id]
PATCH  /api/vault-items/[id]
POST   /api/vault-items/[id]/archive

GET    /api/vault-items/[id]/deadlines
POST   /api/vault-items/[id]/deadlines
PATCH  /api/vault-items/[id]/deadlines/[deadlineId]
DELETE /api/vault-items/[id]/deadlines/[deadlineId]

GET    /api/vault-items/[id]/events
POST   /api/vault-items/[id]/events
PATCH  /api/vault-items/[id]/events/[eventId]
DELETE /api/vault-items/[id]/events/[eventId]
```

This is preferred over Server Actions-only APIs because FE-001 and later browser/E2E tests need a stable request/response contract. It is preferred over one generic RPC endpoint because explicit resources make authorization, validation, review, and failure behavior easier to reason about.

## Authentication and ownership boundary

The browser never supplies `ownerUserId`.

Every route that accesses protected domain data follows this order:

```text
request
→ read HttpOnly `ev_session` cookie on the server
→ resolve Evidence Vault project session
→ derive authenticated local user id
→ validate path/body/query input
→ call an owner-scoped repository/service using that server-derived user id
```

Unauthenticated or expired sessions return:

```json
{
  "error": "authentication_required"
}
```

with HTTP `401`.

No route accepts `userId`, `ownerUserId`, identity subject, session token, Bouquet token, authorization code, or PKCE verifier in JSON/query input.

### Cross-user behavior

A resource that does not exist and a resource owned by another user are intentionally indistinguishable to the caller.

Both return:

```json
{
  "error": "not_found"
}
```

with HTTP `404`.

Do not return `403` for an owner mismatch because that would confirm that another user's resource exists.

This applies to VaultItems, Deadlines, and Evidence Events.

### Nested resource ownership

`deadlines` and `evidenceEvents` do not contain an owner user id directly. Therefore every read/write/delete for a deadline or event must prove ownership through its parent VaultItem.

Repository queries must constrain both:

```text
nestedResource.id = requested nested id
nestedResource.vaultItemId = requested vault id
vaultItems.id = requested vault id
vaultItems.userId = authenticated user id
```

A nested resource id must never be loaded first and authorized afterward using untrusted data.

## Response privacy and cache contract

All authenticated JSON domain responses set:

```text
Cache-Control: no-store
```

Unknown database/provider internals are normalized to:

```json
{
  "error": "internal_error"
}
```

with HTTP `500`.

Responses never include SQL errors, stack traces, session values, storage keys, Bouquet identifiers/tokens, or another user's data.

## Error contract

Use these stable response codes:

| HTTP | body error | Meaning |
|---:|---|---|
| 400 | `invalid_json` | Request body was not valid JSON |
| 401 | `authentication_required` | No active Evidence Vault project session |
| 404 | `not_found` | Resource missing or not owned by caller |
| 409 | `conflict` | Request conflicts with current resource state |
| 422 | `validation_failed` | JSON parsed but domain validation failed |
| 500 | `internal_error` | Unexpected server failure |

Validation responses may include field-safe issue paths/messages produced from the local Evidence Vault Zod schemas, but must not echo arbitrary raw request bodies.

## VaultItem domain contract

Existing categories remain authoritative:

```text
online_purchase
subscription
rental
membership
used_goods
warranty_service
other
```

Medical/health dispute categories are not added.

### Merchant/service name correction

DES-001 defines merchant/service name as optional, while the current Zod schema and database column require it. BE-003 resolves this contract mismatch in favor of the approved Designer specification:

- `merchantName` becomes optional in create/update input,
- normalized blank strings become absence rather than a fake placeholder,
- `ev_vault_items.merchant_name` becomes nullable,
- API output uses `merchantName: string | null`,
- a real Drizzle migration is committed for the nullability change.

No fake merchant value such as `미입력`, `없음`, or an empty string is persisted merely to satisfy the former schema.

### Create input

```ts
type CreateVaultItemInput = {
  title: string;                 // trim, 1..120
  category: VaultCategory;
  merchantName?: string;         // trim, 1..120 when present
  purchaseOrStartDate: string;   // YYYY-MM-DD date-only
  amount?: number;               // integer, 0..9_999_999_999
  currency?: "KRW";              // defaults to KRW
  description?: string;          // trim, max 2000
};
```

Successful create returns HTTP `201` with:

```json
{
  "item": {
    "id": "uuid",
    "title": "...",
    "category": "online_purchase",
    "merchantName": null,
    "purchaseOrStartDate": "2026-08-28",
    "amount": null,
    "currency": "KRW",
    "description": null,
    "status": "active",
    "createdAt": "...",
    "updatedAt": "..."
  }
}
```

The owner id is not returned because FE-001 does not need it.

### List

`GET /api/vault-items` returns caller-owned active items ordered by most recently updated first.

MVP response shape:

```ts
type VaultItemSummary = {
  id: string;
  title: string;
  category: VaultCategory;
  merchantName: string | null;
  purchaseOrStartDate: string;
  amount: number | null;
  currency: "KRW";
  status: "active" | "archived";
  updatedAt: string;
};
```

Default list excludes archived records. A later task may add an archived-management surface; BE-003 does not invent one.

### Detail

`GET /api/vault-items/[id]` returns the owner's VaultItem only. Deadline/event collections use their dedicated endpoints and are not duplicated in the detail response.

### Update

`PATCH /api/vault-items/[id]` accepts a non-empty partial update of user-editable fields:

```text
title
category
merchantName
purchaseOrStartDate
amount
currency
description
```

`id`, `userId`, `status`, `createdAt`, and `updatedAt` are never client-controlled.

To clear optional values:

- `merchantName: null`
- `amount: null`
- `description: null`

are accepted by the update schema.

### Archive

`POST /api/vault-items/[id]/archive` changes an owned active VaultItem to `archived`.

Archive is idempotent: archiving an already archived owned item returns the archived item rather than failing. It is not a destructive delete and must not claim evidence files were destroyed.

BE-003 does not add hard-delete VaultItem behavior because later storage/deletion work must reconcile persisted evidence safely.

## Deadline contract

Existing types remain authoritative:

```text
return_window
renewal
warranty_expiry
contract_end
refund_expected
custom
```

Existing source types remain authoritative:

```text
user_entered
merchant_provided
general_reference
```

The API never labels these as legal deadlines. User-visible wording remains source-labelled factual wording such as `반품 가능일로 기록한 날짜`.

### Create/update input

```ts
type DeadlineInput = {
  type: DeadlineType;
  dueDate: string;
  sourceType: DeadlineSourceType;
  sourceNote?: string;
};
```

PATCH accepts a non-empty partial form and supports `sourceNote: null` to clear the optional note.

### List ordering

Deadline list for one VaultItem is ordered by `dueDate ASC`, then creation time ASC for deterministic output.

### Delete

Deadline delete hard-deletes only that owned factual date row. Successful delete returns HTTP `204` with no body.

## Evidence Event contract

Existing factual event types remain authoritative:

```text
purchased
delivered
defect_found
refund_requested
merchant_replied
refund_received
payment_made
contract_signed
custom
```

### Create/update input

```ts
type EvidenceEventInput = {
  occurredOn: string;
  eventType: EvidenceEventType;
  title: string;
  note?: string;
};
```

The server always sets `createdByUserId` from the authenticated session; the client cannot choose it.

PATCH accepts a non-empty partial form and supports `note: null` to clear the note.

### List ordering

Event list for one VaultItem is chronological: `occurredOn ASC`, then creation time ASC.

### Delete

Event delete hard-deletes only that owned event row. BE-004/later attachment work must preserve the existing database behavior for linked file records (`evidenceEventId` becomes null on event deletion) rather than deleting files as a side effect.

Successful delete returns HTTP `204`.

## Dashboard projection

`GET /api/dashboard` is a read projection for FE-001. It is not an analytics endpoint and must not fabricate scores, percentages, counts from absent data, legal risk, refund probability, or readiness metrics.

Response:

```ts
type DashboardResponse = {
  upcomingDeadlines: Array<{
    id: string;
    vaultItemId: string;
    vaultTitle: string;
    merchantName: string | null;
    type: DeadlineType;
    dueDate: string;
    sourceType: DeadlineSourceType;
    sourceNote: string | null;
  }>;
  recentEvents: Array<{
    id: string;
    vaultItemId: string;
    vaultTitle: string;
    occurredOn: string;
    eventType: EvidenceEventType;
    title: string;
  }>;
  vaultItems: VaultItemSummary[];
};
```

Rules:

- only active VaultItems owned by the authenticated user participate,
- `upcomingDeadlines` contains active reminder rows with due date on/after the server date-only `today`, nearest first, limit 10,
- `recentEvents` contains caller-owned events newest first, limit 10,
- `vaultItems` contains caller-owned active items most recently updated first, limit 20,
- empty data returns three empty arrays rather than fake samples,
- no D-day string is generated by the API; FE-001 can derive localized `D-3`, `D-DAY`, `D+2` display from the returned date-only value using the shared date helper.

The dashboard repository/service must execute owner filters for every projection query rather than loading broad rows and filtering them in JavaScript.

## Repository layer

Extend `src/repositories/vault-repository.ts` and add focused repository modules as needed for deadline/event/dashboard queries.

Every public repository function that reads or mutates user-owned domain data must require `ownerUserId` in its input type.

Representative contracts:

```ts
listVaultItems({ ownerUserId })
createVaultItem({ ownerUserId, input })
getVaultItem({ ownerUserId, id })
updateVaultItem({ ownerUserId, id, input })
archiveVaultItem({ ownerUserId, id })

listDeadlines({ ownerUserId, vaultItemId })
createDeadline({ ownerUserId, vaultItemId, input })
updateDeadline({ ownerUserId, vaultItemId, deadlineId, input })
deleteDeadline({ ownerUserId, vaultItemId, deadlineId })

listEvidenceEvents({ ownerUserId, vaultItemId })
createEvidenceEvent({ ownerUserId, vaultItemId, input })
updateEvidenceEvent({ ownerUserId, vaultItemId, eventId, input })
deleteEvidenceEvent({ ownerUserId, vaultItemId, eventId })

getDashboardProjection({ ownerUserId, today })
```

Mutation repository methods return `null` when the resource is absent or not owned by the caller. Routes map that to the stable `404 not_found` contract.

## Service/route helpers

Create small reusable server helpers instead of duplicating session/error logic across every route.

Required responsibilities:

- resolve authenticated project user from request cookies,
- emit stable JSON errors,
- parse JSON safely,
- apply `Cache-Control: no-store`,
- normalize successful domain rows into safe API DTOs.

These helpers remain server-only and never expose raw `ev_session` values to client components.

## Database migration

BE-003 adds a real Drizzle migration changing:

```text
ev_vault_items.merchant_name
NOT NULL → NULL
```

No other destructive schema change is included unless implementation evidence proves it is necessary for the API contract.

Migration artifacts must be committed and build/test verification must not depend on inventing a production `DATABASE_URL`.

## TDD and security verification

BE-003 must establish RED → GREEN evidence for at least these contracts:

1. VaultItem create/list/detail/update/archive.
2. `merchantName` optional/nullable normalization.
3. Deadline create/list/update/delete.
4. Event create/list/update/delete.
5. Dashboard projection ordering/limits/empty result.
6. unauthenticated API request → stable 401.
7. invalid JSON → 400.
8. invalid domain input → 422.
9. user A cannot read user B VaultItem.
10. user A cannot update/archive user B VaultItem.
11. user A cannot read/create/update/delete Deadline under user B VaultItem.
12. user A cannot read/create/update/delete Event under user B VaultItem.
13. owner mismatch and missing id are both 404.
14. protected responses include `Cache-Control: no-store`.
15. response bodies do not contain owner ids, raw session values, SQL/provider internals, or arbitrary request echoes.

Where database-backed integration tests are impractical in the default unit CI, repository query behavior must still be tested through injectable store/query contracts and type-level ownership tests. Real PostgreSQL integration remains an explicit QA/deployment-equivalent gate and is not falsely claimed from mocks.

## Expected implementation files

Likely production changes:

```text
src/domain/vault-item.ts
src/domain/deadline.ts
src/domain/evidence.ts
src/db/schema.ts
src/repositories/vault-repository.ts
src/repositories/deadline-repository.ts
src/repositories/event-repository.ts
src/repositories/dashboard-repository.ts
src/server/api-auth.ts
src/server/api-response.ts
app/api/dashboard/route.ts
app/api/vault-items/route.ts
app/api/vault-items/[id]/route.ts
app/api/vault-items/[id]/archive/route.ts
app/api/vault-items/[id]/deadlines/route.ts
app/api/vault-items/[id]/deadlines/[deadlineId]/route.ts
app/api/vault-items/[id]/events/route.ts
app/api/vault-items/[id]/events/[eventId]/route.ts
```

Plus focused tests and Drizzle migration artifacts.

Exact filenames may be reduced during implementation if a smaller structure preserves the same explicit interfaces and ownership guarantees; the public API and security contract above are authoritative.

## Out of scope

BE-003 does not implement:

- evidence file upload/download/signing,
- S3/private object storage,
- image/PDF redaction,
- evidence-file integrity workflows,
- onboarding Terms/Privacy persistence,
- case preparation,
- export packet generation,
- account/data deletion reconciliation,
- official-source guide content,
- notifications,
- OCR,
- AI/legal analysis,
- medical dispute workflows,
- public sharing URLs,
- fake analytics/KPI data.

## Acceptance criteria

BE-003 is complete only when:

- all listed resource APIs have stable authenticated contracts,
- caller identity comes only from the Evidence Vault server session,
- repository reads/mutations are owner-scoped at query time,
- cross-user VaultItem/Deadline/Event operations are indistinguishable from not-found,
- merchant/service name is truly optional through schema, database, and API,
- dashboard returns only real caller-owned data and honest empty arrays,
- tests cover ownership-negative cases and API failure states,
- frozen install, full unit suite, TypeScript/Next production build pass on the final PR head,
- verification evidence is recorded in `docs/VERIFICATION.md`,
- no real PostgreSQL/browser/deployment E2E result is claimed unless actually executed.
