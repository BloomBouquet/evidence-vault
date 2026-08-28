# Evidence Vault Vault Domain API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement authenticated, owner-scoped VaultItem, Deadline, Evidence Event, and dashboard APIs required by FE-001.

**Architecture:** Next.js App Router Route Handlers use a small shared request-session/error layer and call repository functions that require `ownerUserId` at query time. Nested Deadline/Event ownership is proven through the parent VaultItem, and the dashboard is a read projection over only active caller-owned rows. Domain validation remains in Zod; Drizzle owns PostgreSQL schema/migration state.

**Tech Stack:** Next.js 16.3.3 App Router, TypeScript 5.x, Zod 4, Drizzle ORM 0.45.x / drizzle-kit 0.31.x, PostgreSQL, Vitest 3.2.x.

**Spec:** `docs/superpowers/specs/2026-08-28-evidence-vault-vault-domain-api-design.md`

## Global Constraints

- Branch: `agent/해바라기/backend/vault-domain-api`; PR base: `develop`.
- Client input never contains trusted ownership identity; `ownerUserId` comes only from the Evidence Vault `ev_session` server session.
- Missing and cross-user resources both return `404 { error: "not_found" }`.
- Protected JSON responses use `Cache-Control: no-store`.
- No SQL errors, stack traces, session values, Bouquet secrets, provider bodies, or arbitrary request bodies are rendered.
- Medical/health dispute categories are not added.
- `merchantName` becomes truly optional/nullable through Zod, Drizzle schema, migration, repository, and API DTOs.
- VaultItem is archived, not hard-deleted, in BE-003.
- Deadline/Event deletion never deletes evidence files as a side effect.
- Dashboard contains only real caller-owned rows and honest empty arrays; no fake KPI/legal-risk/readiness values.
- Production changes follow RED → observed RED → minimal GREEN → full GREEN → review.
- Real PostgreSQL/browser/deployment verification is not claimed unless actually executed.

---

### Task 1: Domain update schemas and nullable merchant migration

**Files:**
- Modify: `src/domain/vault-item.ts`
- Modify: `src/domain/deadline.ts`
- Modify: `src/domain/evidence.ts`
- Modify: `src/db/schema.ts`
- Create: `src/domain/vault-item-update.test.ts`
- Create: `src/domain/deadline-update.test.ts`
- Create: `src/domain/evidence-update.test.ts`
- Create: `drizzle/0000_optional_merchant.sql`
- Create: `drizzle/meta/_journal.json`

**Interfaces:**
- Produces `createVaultItemSchema` with optional `merchantName`.
- Produces `updateVaultItemSchema` accepting a non-empty partial update and nullable `merchantName`, `amount`, `description`.
- Produces `updateDeadlineSchema` accepting a non-empty partial update and nullable `sourceNote`.
- Produces `updateEvidenceEventSchema` accepting a non-empty partial update and nullable `note`.
- Changes `vaultItems.merchantName` to nullable.

- [ ] **Step 1: Write failing VaultItem domain tests**

Create `src/domain/vault-item-update.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createVaultItemSchema, updateVaultItemSchema } from "./vault-item";

const base = {
  title: "노트북 구매",
  category: "online_purchase" as const,
  purchaseOrStartDate: "2026-08-28",
};

describe("VaultItem input contracts", () => {
  it("allows merchantName to be omitted on create", () => {
    expect(createVaultItemSchema.parse(base).merchantName).toBeUndefined();
  });

  it("normalizes blank optional merchant name to absence", () => {
    expect(createVaultItemSchema.parse({ ...base, merchantName: "   " }).merchantName).toBeUndefined();
  });

  it("allows nullable optional fields on update", () => {
    expect(updateVaultItemSchema.parse({ merchantName: null, amount: null, description: null }))
      .toEqual({ merchantName: null, amount: null, description: null });
  });

  it("rejects an empty update", () => {
    expect(updateVaultItemSchema.safeParse({}).success).toBe(false);
  });
});
```

- [ ] **Step 2: Write failing Deadline/Event update tests**

Create `src/domain/deadline-update.test.ts`:

```ts
import { expect, it } from "vitest";
import { updateDeadlineSchema } from "./deadline";

it("supports clearing sourceNote but rejects empty patches", () => {
  expect(updateDeadlineSchema.parse({ sourceNote: null })).toEqual({ sourceNote: null });
  expect(updateDeadlineSchema.safeParse({}).success).toBe(false);
});
```

Create `src/domain/evidence-update.test.ts`:

```ts
import { expect, it } from "vitest";
import { updateEvidenceEventSchema } from "./evidence";

it("supports clearing note but rejects empty patches", () => {
  expect(updateEvidenceEventSchema.parse({ note: null })).toEqual({ note: null });
  expect(updateEvidenceEventSchema.safeParse({}).success).toBe(false);
});
```

- [ ] **Step 3: Run focused tests and verify RED**

Run:

```bash
pnpm vitest run src/domain/vault-item-update.test.ts src/domain/deadline-update.test.ts src/domain/evidence-update.test.ts
```

Expected: FAIL because update schemas do not exist and current create schema rejects missing/blank merchant names.

- [ ] **Step 4: Implement the domain schemas**

Update `src/domain/vault-item.ts` with these helpers/contracts:

```ts
const optionalTrimmedString = (max: number) =>
  z.preprocess(
    (value) => typeof value === "string" && value.trim() === "" ? undefined : value,
    z.string().trim().min(1).max(max).optional(),
  );

export const createVaultItemSchema = z.object({
  title: z.string().trim().min(1).max(120),
  category: z.enum(VAULT_CATEGORIES),
  merchantName: optionalTrimmedString(120),
  purchaseOrStartDate: dateOnlySchema,
  amount: z.number().int().nonnegative().max(9_999_999_999).optional(),
  currency: z.literal("KRW").default("KRW"),
  description: optionalTrimmedString(2000),
});

export const updateVaultItemSchema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  category: z.enum(VAULT_CATEGORIES).optional(),
  merchantName: z.string().trim().min(1).max(120).nullable().optional(),
  purchaseOrStartDate: dateOnlySchema.optional(),
  amount: z.number().int().nonnegative().max(9_999_999_999).nullable().optional(),
  currency: z.literal("KRW").optional(),
  description: z.string().trim().max(2000).nullable().optional(),
}).refine((value) => Object.keys(value).length > 0, "empty_update");
```

Update `src/domain/deadline.ts`:

```ts
export const updateDeadlineSchema = z.object({
  type: z.enum(DEADLINE_TYPES).optional(),
  dueDate: dateOnlySchema.optional(),
  sourceType: z.enum(DEADLINE_SOURCE_TYPES).optional(),
  sourceNote: z.string().trim().max(500).nullable().optional(),
}).refine((value) => Object.keys(value).length > 0, "empty_update");
```

Update `src/domain/evidence.ts`:

```ts
export const updateEvidenceEventSchema = z.object({
  occurredOn: dateOnlySchema.optional(),
  eventType: z.enum(EVIDENCE_EVENT_TYPES).optional(),
  title: z.string().trim().min(1).max(120).optional(),
  note: z.string().trim().max(4000).nullable().optional(),
}).refine((value) => Object.keys(value).length > 0, "empty_update");
```

- [ ] **Step 5: Make merchantName nullable in Drizzle schema**

Change only this column in `src/db/schema.ts`:

```ts
merchantName: varchar("merchant_name", { length: 120 }),
```

- [ ] **Step 6: Add the first Drizzle migration artifacts**

Create `drizzle/0000_optional_merchant.sql`:

```sql
ALTER TABLE "ev_vault_items" ALTER COLUMN "merchant_name" DROP NOT NULL;
```

Create `drizzle/meta/_journal.json`:

```json
{
  "version": "7",
  "dialect": "postgresql",
  "entries": [
    {
      "idx": 0,
      "version": "7",
      "when": 1787878800000,
      "tag": "0000_optional_merchant",
      "breakpoints": true
    }
  ]
}
```

The journal timestamp is metadata only; migration correctness is the SQL contract above. Do not claim `db:migrate` against a real database until a real PostgreSQL target is available.

- [ ] **Step 7: Run focused and full verification**

Run:

```bash
pnpm vitest run src/domain/vault-item-update.test.ts src/domain/deadline-update.test.ts src/domain/evidence-update.test.ts
pnpm test:run
pnpm build
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/domain src/db/schema.ts drizzle
 git commit -m "feat: align vault domain update contracts"
```

---

### Task 2: Shared authenticated API request/response helpers

**Files:**
- Create: `src/server/api-auth.ts`
- Create: `src/server/api-response.ts`
- Create: `src/server/api-auth.test.ts`
- Create: `src/server/api-response.test.ts`

**Interfaces:**
- Produces `readCookie(request, name): string | null`.
- Produces `resolveApiUser(request, resolveSession?): Promise<{ id: string; displayName: string } | null>`.
- Produces `jsonNoStore(body, init?): NextResponse`.
- Produces `apiError(error, status, issues?): NextResponse`.
- Produces `parseJsonBody(request): Promise<{ ok: true; value: unknown } | { ok: false; response: NextResponse }>`.

- [ ] **Step 1: Write failing auth-helper tests**

```ts
import { describe, expect, it, vi } from "vitest";
import { readCookie, resolveApiUser } from "./api-auth";

describe("api auth", () => {
  it("reads only the requested cookie", () => {
    const request = new Request("https://vault.example.com/api/vault-items", {
      headers: { cookie: "other=x; ev_session=raw%20token" },
    });
    expect(readCookie(request, "ev_session")).toBe("raw token");
  });

  it("resolves the project session server-side", async () => {
    const resolver = vi.fn(async () => ({ id: "user-1", displayName: "순우" }));
    const request = new Request("https://vault.example.com/api/vault-items", {
      headers: { cookie: "ev_session=raw-token" },
    });
    await expect(resolveApiUser(request, resolver)).resolves.toEqual({ id: "user-1", displayName: "순우" });
    expect(resolver).toHaveBeenCalledWith("raw-token");
  });
});
```

- [ ] **Step 2: Write failing response-helper tests**

```ts
import { expect, it } from "vitest";
import { apiError, jsonNoStore, parseJsonBody } from "./api-response";

it("adds no-store to authenticated JSON", async () => {
  const response = jsonNoStore({ ok: true });
  expect(response.headers.get("cache-control")).toContain("no-store");
});

it("normalizes malformed JSON", async () => {
  const result = await parseJsonBody(new Request("https://vault.example.com/api/vault-items", {
    method: "POST",
    body: "{",
  }));
  expect(result.ok).toBe(false);
  if (!result.ok) {
    expect(result.response.status).toBe(400);
    await expect(result.response.json()).resolves.toEqual({ error: "invalid_json" });
  }
});

it("does not echo arbitrary details in generic errors", async () => {
  const response = apiError("internal_error", 500);
  expect(await response.text()).toBe('{"error":"internal_error"}');
});
```

- [ ] **Step 3: Run focused tests and verify RED**

Run:

```bash
pnpm vitest run src/server/api-auth.test.ts src/server/api-response.test.ts
```

Expected: FAIL because the helper modules do not exist.

- [ ] **Step 4: Implement `api-auth.ts`**

```ts
import { resolveProjectSession } from "@/src/auth/project-session";

export function readCookie(request: Request, name: string) {
  const header = request.headers.get("cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const trimmed = part.trim();
    const separator = trimmed.indexOf("=");
    if (separator < 0 || trimmed.slice(0, separator) !== name) continue;
    const value = trimmed.slice(separator + 1);
    try { return decodeURIComponent(value); } catch { return value; }
  }
  return null;
}

export async function resolveApiUser(
  request: Request,
  resolveSession: typeof resolveProjectSession = resolveProjectSession,
) {
  return resolveSession(readCookie(request, "ev_session"));
}
```

- [ ] **Step 5: Implement `api-response.ts`**

```ts
import { NextResponse } from "next/server";

export function jsonNoStore(body: unknown, init: ResponseInit = {}) {
  const response = NextResponse.json(body, init);
  response.headers.set("cache-control", "no-store");
  return response;
}

export function apiError(
  error: "invalid_json" | "authentication_required" | "not_found" | "conflict" | "validation_failed" | "internal_error",
  status: number,
  issues?: unknown,
) {
  return jsonNoStore(issues === undefined ? { error } : { error, issues }, { status });
}

export async function parseJsonBody(request: Request) {
  try {
    return { ok: true as const, value: await request.json() as unknown };
  } catch {
    return { ok: false as const, response: apiError("invalid_json", 400) };
  }
}
```

- [ ] **Step 6: Run focused/full tests and build**

Run:

```bash
pnpm vitest run src/server/api-auth.test.ts src/server/api-response.test.ts
pnpm test:run
pnpm build
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/server/api-auth.ts src/server/api-response.ts src/server/api-auth.test.ts src/server/api-response.test.ts
 git commit -m "feat: add authenticated API helpers"
```

---

### Task 3: Owner-scoped VaultItem repository and routes

**Files:**
- Modify: `src/repositories/vault-repository.ts`
- Create: `src/repositories/vault-repository.test.ts`
- Create: `app/api/vault-items/route.ts`
- Create: `app/api/vault-items/route.test.ts`
- Create: `app/api/vault-items/[id]/route.ts`
- Create: `app/api/vault-items/[id]/route.test.ts`
- Create: `app/api/vault-items/[id]/archive/route.ts`
- Create: `app/api/vault-items/[id]/archive/route.test.ts`

**Interfaces:**
- Produces `listVaultItems`, `createVaultItem`, `getVaultItem`, `updateVaultItem`, `archiveVaultItem`.
- Route handlers accept injectable dependency objects for unit tests and export normal Next.js `GET/POST/PATCH` handlers using real dependencies.

- [ ] **Step 1: Write failing repository contract tests**

Add tests that assert each function's first input structurally requires `ownerUserId`, and use an injected store adapter to prove caller A's operations pass caller A's id into every list/read/write/archive operation.

Use this adapter shape in `src/repositories/vault-repository.test.ts`:

```ts
type VaultStore = {
  list(ownerUserId: string): Promise<unknown[]>;
  create(ownerUserId: string, input: CreateVaultItemInput): Promise<unknown>;
  get(ownerUserId: string, id: string): Promise<unknown | null>;
  update(ownerUserId: string, id: string, input: UpdateVaultItemInput): Promise<unknown | null>;
  archive(ownerUserId: string, id: string): Promise<unknown | null>;
};
```

Expose store-backed functions from the repository for unit testing:

```ts
listVaultItemsWithStore(store, input)
createVaultItemWithStore(store, input)
getVaultItemWithStore(store, input)
updateVaultItemWithStore(store, input)
archiveVaultItemWithStore(store, input)
```

- [ ] **Step 2: Write failing route tests**

For `app/api/vault-items/route.test.ts`, cover:

```text
GET unauthenticated -> 401 + no-store
GET authenticated -> only repository result
POST malformed JSON -> 400
POST invalid Zod body -> 422
POST authenticated valid body -> repository receives server-derived user id and 201
response body never contains raw ev_session
```

For `[id]/route.test.ts`, cover:

```text
GET absent/cross-user repository null -> 404
PATCH malformed/invalid -> 400/422
PATCH repository null -> 404
PATCH owned -> 200
```

For archive route, cover:

```text
unauthenticated -> 401
repository null -> 404
owned active/already archived -> 200
```

Use exported response factories with dependency injection rather than mocking Drizzle globally.

- [ ] **Step 3: Run focused tests and verify RED**

Run:

```bash
pnpm vitest run src/repositories/vault-repository.test.ts app/api/vault-items/route.test.ts 'app/api/vault-items/[id]/route.test.ts' 'app/api/vault-items/[id]/archive/route.test.ts'
```

Expected: FAIL because the repository methods/routes do not exist.

- [ ] **Step 4: Implement Drizzle VaultItem repository**

Use owner conditions in the SQL query itself:

```ts
.where(and(eq(vaultItems.id, id), eq(vaultItems.userId, ownerUserId)))
```

List uses:

```ts
.where(and(eq(vaultItems.userId, ownerUserId), eq(vaultItems.status, "active")))
.orderBy(desc(vaultItems.updatedAt))
```

Create injects `userId: ownerUserId`; client input never supplies it.

Update uses `.update(vaultItems).set({ ...input, updatedAt: new Date() }).where(and(...)).returning()`.

Archive sets `{ status: "archived", updatedAt: new Date() }` under the same owner/id predicate and returns the row.

- [ ] **Step 5: Implement `/api/vault-items` route**

Export:

```ts
export type VaultCollectionDependencies = {
  resolveUser: typeof resolveApiUser;
  list: typeof listVaultItems;
  create: typeof createVaultItem;
};

export async function createVaultCollectionResponse(request: Request, deps: VaultCollectionDependencies) { /* exact auth/parse/Zod/repository mapping */ }
```

`GET` maps authentication failure to 401; `POST` validates `createVaultItemSchema` and returns `201 { item }`.

- [ ] **Step 6: Implement detail/update/archive routes**

Use route context `params: Promise<{ id: string }>` for Next.js 16 App Router handlers.

`PATCH` parses body, validates `updateVaultItemSchema`, calls repository with server-derived `ownerUserId`, and maps null to 404.

Archive uses POST only and never accepts a body-controlled status.

- [ ] **Step 7: Run focused/full tests and build**

Run:

```bash
pnpm vitest run src/repositories/vault-repository.test.ts app/api/vault-items/route.test.ts 'app/api/vault-items/[id]/route.test.ts' 'app/api/vault-items/[id]/archive/route.test.ts'
pnpm test:run
pnpm build
```

Expected: PASS and build lists the VaultItem API routes.

- [ ] **Step 8: Commit**

```bash
git add src/repositories/vault-repository.ts src/repositories/vault-repository.test.ts app/api/vault-items
 git commit -m "feat: add owner-scoped vault item API"
```

---

### Task 4: Owner-scoped Deadline repository and nested routes

**Files:**
- Create: `src/repositories/deadline-repository.ts`
- Create: `src/repositories/deadline-repository.test.ts`
- Create: `app/api/vault-items/[id]/deadlines/route.ts`
- Create: `app/api/vault-items/[id]/deadlines/route.test.ts`
- Create: `app/api/vault-items/[id]/deadlines/[deadlineId]/route.ts`
- Create: `app/api/vault-items/[id]/deadlines/[deadlineId]/route.test.ts`

**Interfaces:**
- Produces `listDeadlines`, `createDeadline`, `updateDeadline`, `deleteDeadline`.
- Every repository input includes `ownerUserId` and `vaultItemId`; single-row mutation additionally includes `deadlineId`.

- [ ] **Step 1: Write failing repository tests for nested ownership**

Define an injected store whose methods all receive `{ ownerUserId, vaultItemId, ... }`. Tests must prove a nested deadline is never addressed by `deadlineId` alone.

Add a type-level assertion:

```ts
expectTypeOf(updateDeadline).parameter(0).toMatchTypeOf<{
  ownerUserId: string;
  vaultItemId: string;
  deadlineId: string;
}>();
```

- [ ] **Step 2: Write failing nested route tests**

Cover:

```text
list/create under unowned parent -> repository null -> 404
create valid -> 201
create invalid -> 422
update/delete unowned or missing nested id -> 404
update valid -> 200
delete valid -> 204
all responses preserve no-store where a body exists
```

- [ ] **Step 3: Run focused tests and verify RED**

Run:

```bash
pnpm vitest run src/repositories/deadline-repository.test.ts 'app/api/vault-items/[id]/deadlines/route.test.ts' 'app/api/vault-items/[id]/deadlines/[deadlineId]/route.test.ts'
```

Expected: FAIL because deadline repository/routes do not exist.

- [ ] **Step 4: Implement nested Drizzle queries**

Every Deadline query joins `vaultItems` and constrains owner at query time. Representative read predicate:

```ts
.innerJoin(vaultItems, eq(deadlines.vaultItemId, vaultItems.id))
.where(and(
  eq(deadlines.vaultItemId, vaultItemId),
  eq(vaultItems.userId, ownerUserId),
))
```

Before create, prove the parent exists for the owner with an owner-scoped VaultItem query; if absent return null.

Update/delete use both nested id, parent id, and an owner-constrained subquery/join pattern; do not load by `deadlineId` first and authorize in JavaScript.

- [ ] **Step 5: Implement collection/detail route factories**

Collection POST validates `createDeadlineSchema`; PATCH validates `updateDeadlineSchema`; delete returns `new Response(null, { status: 204, headers: { "cache-control": "no-store" } })`.

- [ ] **Step 6: Run focused/full tests and build**

Run:

```bash
pnpm vitest run src/repositories/deadline-repository.test.ts 'app/api/vault-items/[id]/deadlines/route.test.ts' 'app/api/vault-items/[id]/deadlines/[deadlineId]/route.test.ts'
pnpm test:run
pnpm build
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/repositories/deadline-repository.ts src/repositories/deadline-repository.test.ts app/api/vault-items/[id]/deadlines
 git commit -m "feat: add owner-scoped deadline API"
```

---

### Task 5: Owner-scoped Evidence Event repository and nested routes

**Files:**
- Create: `src/repositories/event-repository.ts`
- Create: `src/repositories/event-repository.test.ts`
- Create: `app/api/vault-items/[id]/events/route.ts`
- Create: `app/api/vault-items/[id]/events/route.test.ts`
- Create: `app/api/vault-items/[id]/events/[eventId]/route.ts`
- Create: `app/api/vault-items/[id]/events/[eventId]/route.test.ts`

**Interfaces:**
- Produces `listEvidenceEvents`, `createEvidenceEvent`, `updateEvidenceEvent`, `deleteEvidenceEvent`.
- Create sets `createdByUserId = ownerUserId` server-side.

- [ ] **Step 1: Write failing repository tests**

Assert:

```text
all public methods require ownerUserId + vaultItemId
single-row mutation requires eventId too
create ignores any client owner/creator concept and store receives createdByUserId equal to ownerUserId
list ordering contract is occurredOn ASC then createdAt ASC
```

- [ ] **Step 2: Write failing route tests**

Cover the same authentication/400/422/404/200/201/204 contracts as Deadline, plus assert a body containing `createdByUserId` cannot override the server owner because the Zod schema strips/rejects unsupported ownership input before repository mapping.

Prefer strict route DTO construction: pass only fields returned by `createEvidenceEventSchema` / `updateEvidenceEventSchema`, never spread raw request JSON into repository input.

- [ ] **Step 3: Run focused tests and verify RED**

Run:

```bash
pnpm vitest run src/repositories/event-repository.test.ts 'app/api/vault-items/[id]/events/route.test.ts' 'app/api/vault-items/[id]/events/[eventId]/route.test.ts'
```

Expected: FAIL because Event repository/routes do not exist.

- [ ] **Step 4: Implement nested owner-scoped Event repository**

Use the same query-time parent ownership proof as Deadline. Creation inserts:

```ts
{
  vaultItemId,
  createdByUserId: ownerUserId,
  ...input,
}
```

Update/delete constrain event id + parent id + parent owner in SQL. Event delete does not touch `evidenceFiles`; the schema's existing `ON DELETE SET NULL` link behavior remains authoritative.

- [ ] **Step 5: Implement Event route factories**

Collection route maps valid create to `201 { event }`; detail route maps patch to `200 { event }` and delete to 204.

- [ ] **Step 6: Run focused/full tests and build**

Run:

```bash
pnpm vitest run src/repositories/event-repository.test.ts 'app/api/vault-items/[id]/events/route.test.ts' 'app/api/vault-items/[id]/events/[eventId]/route.test.ts'
pnpm test:run
pnpm build
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/repositories/event-repository.ts src/repositories/event-repository.test.ts app/api/vault-items/[id]/events
 git commit -m "feat: add owner-scoped evidence event API"
```

---

### Task 6: Dashboard work-queue projection

**Files:**
- Create: `src/repositories/dashboard-repository.ts`
- Create: `src/repositories/dashboard-repository.test.ts`
- Create: `app/api/dashboard/route.ts`
- Create: `app/api/dashboard/route.test.ts`

**Interfaces:**
- Produces `getDashboardProjection({ ownerUserId, today })`.
- Produces `createDashboardResponse(request, dependencies, today?)` for route testing.

- [ ] **Step 1: Write failing repository projection tests**

Use an injected dashboard store and fixed `today = "2026-08-28"` to assert the repository/service contract returns:

```ts
{
  upcomingDeadlines: [],
  recentEvents: [],
  vaultItems: [],
}
```

for an empty account, never sample data.

Add ordering/window fixtures that require:

```text
2026-08-21 (D+7) included
2026-08-20 (D+8) excluded
2026-08-26 then 2026-08-27 overdue ordering (most recently missed first means 27 before 26)
2026-08-28 today after overdue rows
2026-08-29, 2026-09-01 future nearest first
maximum 10 deadline rows
maximum 10 recent events
maximum 20 active vault items
archived VaultItems excluded from every projection
```

- [ ] **Step 2: Write failing dashboard route tests**

Cover:

```text
anonymous -> 401
owner id comes from resolved session
empty -> three empty arrays
repository result -> returned unchanged safe DTO
no-store header
repository exception -> 500 internal_error without raw message
```

- [ ] **Step 3: Run focused tests and verify RED**

Run:

```bash
pnpm vitest run src/repositories/dashboard-repository.test.ts app/api/dashboard/route.test.ts
```

Expected: FAIL because dashboard repository/route do not exist.

- [ ] **Step 4: Implement dashboard repository**

Use owner constraints in each SQL query. Derive the recent-overdue lower bound with the shared date-only math, not `Date` timezone arithmetic:

```ts
const recentOverdueStart = addDays(today, -7);
```

If `addDays` does not exist yet, add it to `src/domain/date.ts` with a focused unit test and implement it by converting the date-only UTC day number back to `YYYY-MM-DD` deterministically.

Deadline query includes `reminderState = "active"`, active parent VaultItems, `dueDate >= recentOverdueStart`, and limit 10 after the required ordering. Recent Event and VaultItem queries are also owner/active scoped and limited in SQL.

- [ ] **Step 5: Implement dashboard route**

Resolve session user, call `getDashboardProjection`, and return `jsonNoStore(projection)`. Catch unexpected repository failure and return `apiError("internal_error", 500)`.

- [ ] **Step 6: Run focused/full tests and build**

Run:

```bash
pnpm vitest run src/repositories/dashboard-repository.test.ts app/api/dashboard/route.test.ts src/domain/date.test.ts
pnpm test:run
pnpm build
```

Expected: PASS and build lists `/api/dashboard`.

- [ ] **Step 7: Commit**

```bash
git add src/repositories/dashboard-repository.ts src/repositories/dashboard-repository.test.ts app/api/dashboard src/domain/date.ts src/domain/date.test.ts
 git commit -m "feat: add dashboard work queue API"
```

---

### Task 7: Cross-user security regression gate and verification evidence

**Files:**
- Modify: `src/repositories/ownership-contract.test.ts`
- Create: `src/server/domain-api-security.test.ts`
- Modify: `docs/VERIFICATION.md`

**Interfaces:**
- Extends the repository ownership type contract to VaultItem/Deadline/Event mutations and dashboard reads.
- Adds a route-level security suite that proves owner identity is session-derived and owner mismatch maps to 404.

- [ ] **Step 1: Extend type-level ownership contract**

Add assertions for:

```ts
expectTypeOf(updateVaultItem).parameter(0).toMatchTypeOf<{ ownerUserId: string; id: string }>();
expectTypeOf(archiveVaultItem).parameter(0).toMatchTypeOf<{ ownerUserId: string; id: string }>();
expectTypeOf(updateDeadline).parameter(0).toMatchTypeOf<{ ownerUserId: string; vaultItemId: string; deadlineId: string }>();
expectTypeOf(updateEvidenceEvent).parameter(0).toMatchTypeOf<{ ownerUserId: string; vaultItemId: string; eventId: string }>();
expectTypeOf(getDashboardProjection).parameter(0).toMatchTypeOf<{ ownerUserId: string; today: string }>();
```

- [ ] **Step 2: Add cross-user route security tests**

In `src/server/domain-api-security.test.ts`, invoke exported response factories with:

```text
resolved session user = user-a
requested ids configured by repository fake as user-b/not-owned -> null
```

Assert for VaultItem detail/update/archive, Deadline list/create/update/delete, and Event list/create/update/delete:

```text
status = 404 for repository null owner mismatch
body contains only { error: "not_found" } where a JSON body exists
body does not contain user-b, raw session, SQL text, provider data
```

Also pass input containing `ownerUserId: "user-b"` / `userId: "user-b"` / `createdByUserId: "user-b"` and assert repository calls still use `user-a` only.

- [ ] **Step 3: Verify the security suite fails if any route still leaks/accepts ownership input**

Run:

```bash
pnpm vitest run src/repositories/ownership-contract.test.ts src/server/domain-api-security.test.ts
```

Expected before final hardening: any uncovered ownership/input leak fails. If it already passes because Tasks 3-6 fully satisfy the contract, record that this Task is a regression gate rather than inventing an artificial production defect.

- [ ] **Step 4: Fix only evidence-backed security failures**

Allowed fixes are limited to:

```text
server-derived owner mapping
query-time owner predicates
404 normalization
response no-store
safe DTO construction
removal of raw error/request echo
```

Do not widen BE-003 scope.

- [ ] **Step 5: Run fresh final verification**

Run:

```bash
pnpm install --frozen-lockfile
pnpm test:run
pnpm build
```

Expected: all exit 0. Record exact test-file/test counts from the fresh output.

- [ ] **Step 6: Update `docs/VERIFICATION.md`**

Add section `## Vault domain API BE-003` containing:

```text
TDD RED run ids for each task
final PR-head CI run id
exact test file/test counts
production build result and generated API routes
merchantName migration artifact paths
security contract summary
explicit statement that real PostgreSQL migration/E2E was not executed unless it actually was
```

- [ ] **Step 7: Commit verification evidence**

```bash
git add src/repositories/ownership-contract.test.ts src/server/domain-api-security.test.ts docs/VERIFICATION.md
 git commit -m "test: verify vault domain API security"
```

- [ ] **Step 8: Open/update the BE-003 PR**

PR title:

```text
feat : 증빙함 도메인 API 구현
```

PR base: `develop`.

PR body must use the repository's fixed Korean PR template sections and report only observed test/build evidence.

---

## Self-Review

- **Spec coverage:** authentication, no-store, stable errors, optional merchant migration, VaultItem CRUD/archive, Deadline/Event CRUD, dashboard recent-overdue/future work queue, owner-scoped queries, negative cross-user tests, and explicit non-claims for real PostgreSQL/browser E2E all map to Tasks 1-7.
- **Placeholder scan:** no `TBD`, `TODO`, `implement later`, or unspecified test obligations remain. Conditional wording is limited to evidence-dependent cases such as whether an already-correct security suite needs a production fix.
- **Type consistency:** `ownerUserId`, `vaultItemId`, `deadlineId`, `eventId`, `today`, update schema names, and API error identifiers are consistent with the design spec throughout the plan.

## Execution Handoff

Use Inline Execution in this session because this ChatGPT harness does not expose a true fresh-subagent dispatch primitive. Keep the Backend task on `agent/해바라기/backend/vault-domain-api`; do not pretend same-session self-review is an independent Code Review Agent. Execute Task 1 through Task 7 with fresh GitHub Actions evidence at each RED/GREEN gate.
