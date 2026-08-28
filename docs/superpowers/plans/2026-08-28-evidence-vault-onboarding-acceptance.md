# Evidence Vault Onboarding Acceptance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a server-enforced, versioned onboarding acceptance gate for the 14+ acknowledgement and current Terms/Privacy versions without collecting additional demographic data.

**Architecture:** Persist append-only acceptance snapshots keyed by authenticated local user plus current Terms/Privacy version pair. Keep policy versions server-owned, expose a small owner-scoped service and `/api/onboarding` GET/POST, and reuse the same service for the later protected-route completion gate.

**Tech Stack:** Next.js 16 App Router, TypeScript, Zod, PostgreSQL 16, Drizzle ORM, Vitest.

**Spec:** `docs/superpowers/specs/2026-08-28-evidence-vault-onboarding-acceptance-design.md`

## Global Constraints

- Do not collect date of birth, resident-registration number, phone number, address, or other demographic data for onboarding.
- `age14Confirmed` is only an acknowledgement and must never be described as formal age or identity verification.
- Current Terms/Privacy versions are server-owned configuration; request bodies cannot choose versions, timestamps, owners, or identity subjects.
- All ownership comes from the verified Evidence Vault session user.
- Current acceptance is complete only when one owner-scoped snapshot matches both current policy versions.
- Repeated acceptance of the same current policy pair is idempotent.
- Old acceptance rows remain historical and do not satisfy newer policy versions.
- Authenticated onboarding JSON responses use `Cache-Control: no-store`.
- External errors remain `authentication_required`, `validation_failed`, or `internal_error`; do not expose SQL/config/session internals.
- Existing migrations 0000-0002 are immutable; this task adds `0003_onboarding_acceptances`.
- Follow RED → observed RED → minimal GREEN → full GREEN for every production behavior.

---

### Task 1: Policy version configuration and request validation

**Files:**
- Create: `src/onboarding/config.ts`
- Create: `src/domain/onboarding.ts`
- Test: `src/onboarding/config.test.ts`
- Test: `src/domain/onboarding.test.ts`
- Modify: `.env.example`

**Interfaces:**
- Produces:
  ```ts
  export type CurrentPolicyVersions = {
    termsVersion: string;
    privacyVersion: string;
  };

  export function getCurrentPolicyVersions(
    env?: NodeJS.ProcessEnv,
  ): CurrentPolicyVersions;

  export const acceptOnboardingSchema: z.ZodType<{
    age14Confirmed: true;
    termsAccepted: true;
    privacyAccepted: true;
  }>;
  ```
- Environment keys: `TERMS_VERSION`, `PRIVACY_VERSION`.

- [ ] **Step 1: Write the failing policy-config tests**

```ts
import { describe, expect, it } from "vitest";
import { getCurrentPolicyVersions } from "./config";

describe("getCurrentPolicyVersions", () => {
  it("returns trimmed server-owned versions", () => {
    expect(getCurrentPolicyVersions({
      TERMS_VERSION: " terms-v1 ",
      PRIVACY_VERSION: " privacy-v1 ",
    } as NodeJS.ProcessEnv)).toEqual({
      termsVersion: "terms-v1",
      privacyVersion: "privacy-v1",
    });
  });

  it.each([
    [{ TERMS_VERSION: "", PRIVACY_VERSION: "privacy-v1" }],
    [{ TERMS_VERSION: "terms-v1", PRIVACY_VERSION: "" }],
    [{ TERMS_VERSION: "x".repeat(65), PRIVACY_VERSION: "privacy-v1" }],
  ])("rejects invalid policy config", (env) => {
    expect(() => getCurrentPolicyVersions(env as NodeJS.ProcessEnv))
      .toThrow("onboarding_config_invalid");
  });
});
```

- [ ] **Step 2: Write the failing request-schema tests**

```ts
import { describe, expect, it } from "vitest";
import { acceptOnboardingSchema } from "./onboarding";

describe("acceptOnboardingSchema", () => {
  it("accepts only all-true acknowledgements", () => {
    expect(acceptOnboardingSchema.parse({
      age14Confirmed: true,
      termsAccepted: true,
      privacyAccepted: true,
    })).toEqual({
      age14Confirmed: true,
      termsAccepted: true,
      privacyAccepted: true,
    });
  });

  it.each([
    [{ age14Confirmed: false, termsAccepted: true, privacyAccepted: true }],
    [{ age14Confirmed: true, termsAccepted: false, privacyAccepted: true }],
    [{ age14Confirmed: true, termsAccepted: true, privacyAccepted: false }],
    [{}],
  ])("rejects incomplete acknowledgement", (input) => {
    expect(acceptOnboardingSchema.safeParse(input).success).toBe(false);
  });
});
```

- [ ] **Step 3: Run the focused tests and verify RED**

Run:
```bash
pnpm vitest run src/onboarding/config.test.ts src/domain/onboarding.test.ts
```
Expected: FAIL because `config.ts` and `domain/onboarding.ts` do not exist.

- [ ] **Step 4: Implement minimal config and schema**

```ts
// src/onboarding/config.ts
export type CurrentPolicyVersions = {
  termsVersion: string;
  privacyVersion: string;
};

function version(env: NodeJS.ProcessEnv, key: string) {
  const value = env[key]?.trim();
  if (!value || value.length > 64) throw new Error("onboarding_config_invalid");
  return value;
}

export function getCurrentPolicyVersions(
  env: NodeJS.ProcessEnv = process.env,
): CurrentPolicyVersions {
  return {
    termsVersion: version(env, "TERMS_VERSION"),
    privacyVersion: version(env, "PRIVACY_VERSION"),
  };
}
```

```ts
// src/domain/onboarding.ts
import { z } from "zod";

export const acceptOnboardingSchema = z.object({
  age14Confirmed: z.literal(true),
  termsAccepted: z.literal(true),
  privacyAccepted: z.literal(true),
}).strict();
```

Append to `.env.example`:
```dotenv
# Version identifiers must match the deployed Terms and Privacy documents.
TERMS_VERSION=
PRIVACY_VERSION=
```

- [ ] **Step 5: Run focused tests and verify GREEN**

Run:
```bash
pnpm vitest run src/onboarding/config.test.ts src/domain/onboarding.test.ts
```
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add .env.example src/onboarding/config.ts src/onboarding/config.test.ts src/domain/onboarding.ts src/domain/onboarding.test.ts
git commit -m "feat: add onboarding policy contract"
```

---

### Task 2: Append-only acceptance schema, migration, and repository

**Files:**
- Modify: `src/db/schema.ts`
- Create: `drizzle/0003_onboarding_acceptances.sql`
- Modify: `drizzle/meta/_journal.json`
- Create: `src/repositories/onboarding-repository.ts`
- Test: `src/repositories/onboarding-repository.test.ts`
- Test: `src/db/onboarding-migration.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export type OnboardingAcceptanceRecord = {
    id: string;
    userId: string;
    age14ConfirmedAt: Date;
    termsVersion: string;
    termsAcceptedAt: Date;
    privacyVersion: string;
    privacyAcceptedAt: Date;
    createdAt: Date;
  };

  export async function findCurrentAcceptance(input: {
    ownerUserId: string;
    termsVersion: string;
    privacyVersion: string;
  }): Promise<OnboardingAcceptanceRecord | null>;

  export async function ensureCurrentAcceptance(input: {
    ownerUserId: string;
    termsVersion: string;
    privacyVersion: string;
    acceptedAt: Date;
  }): Promise<OnboardingAcceptanceRecord>;
  ```

- [ ] **Step 1: Write the failing migration-contract test**

```ts
import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

it("keeps 0003 onboarding after the committed 0000-0002 sequence", async () => {
  const journal = JSON.parse(await readFile("drizzle/meta/_journal.json", "utf8"));
  expect(journal.entries.map((entry: { tag: string }) => entry.tag)).toEqual([
    "0000_evidence_vault_initial",
    "0001_deletion_job_idempotency",
    "0002_optional_merchant",
    "0003_onboarding_acceptances",
  ]);
  expect(await readFile("drizzle/0003_onboarding_acceptances.sql", "utf8"))
    .toContain("ev_onboarding_acceptances");
});
```

- [ ] **Step 2: Write repository tests with an injected store**

The tests must prove:
- owner + exact version pair lookup,
- missing row returns null,
- same version pair returns existing row after conflict,
- no user ID is generated from request data inside the repository wrapper.

Use an exported `OnboardingAcceptanceStore` and `ensureCurrentAcceptanceWithStore(...)` so unit tests do not need a live DB for repository behavior.

- [ ] **Step 3: Run focused tests and verify RED**

Run:
```bash
pnpm vitest run src/db/onboarding-migration.test.ts src/repositories/onboarding-repository.test.ts
```
Expected: FAIL because migration/repository do not exist.

- [ ] **Step 4: Extend Drizzle schema**

Add:
```ts
export const onboardingAcceptances = pgTable(
  "ev_onboarding_acceptances",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    age14ConfirmedAt: timestamp("age_14_confirmed_at", { withTimezone: true }).notNull(),
    termsVersion: varchar("terms_version", { length: 64 }).notNull(),
    termsAcceptedAt: timestamp("terms_accepted_at", { withTimezone: true }).notNull(),
    privacyVersion: varchar("privacy_version", { length: 64 }).notNull(),
    privacyAcceptedAt: timestamp("privacy_accepted_at", { withTimezone: true }).notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex("ev_onboarding_acceptances_owner_versions_unique").on(
      table.userId,
      table.termsVersion,
      table.privacyVersion,
    ),
  ],
);
```

- [ ] **Step 5: Add committed migration and journal entry**

`drizzle/0003_onboarding_acceptances.sql` must create the table, FK, and unique index corresponding exactly to the Drizzle schema. Append journal entry with `idx: 3`, tag `0003_onboarding_acceptances`, and a monotonic `when` value greater than 0002.

- [ ] **Step 6: Implement owner/version repository**

`findCurrentAcceptance` must query by all three trusted columns:
```ts
and(
  eq(onboardingAcceptances.userId, ownerUserId),
  eq(onboardingAcceptances.termsVersion, termsVersion),
  eq(onboardingAcceptances.privacyVersion, privacyVersion),
)
```

`ensureCurrentAcceptance` must be idempotent under concurrent requests: use `INSERT ... ON CONFLICT DO NOTHING`, then re-read the exact owner/version pair. Never use a pre-check alone as the idempotency guarantee.

- [ ] **Step 7: Run PostgreSQL migration and focused tests**

Run:
```bash
pnpm db:migrate
pnpm vitest run src/db/onboarding-migration.test.ts src/repositories/onboarding-repository.test.ts
```
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/db/schema.ts drizzle/0003_onboarding_acceptances.sql drizzle/meta/_journal.json src/repositories/onboarding-repository.ts src/repositories/onboarding-repository.test.ts src/db/onboarding-migration.test.ts
git commit -m "feat: persist onboarding acceptances"
```

---

### Task 3: Current onboarding state and completion service

**Files:**
- Create: `src/services/onboarding-service.ts`
- Test: `src/services/onboarding-service.test.ts`

**Interfaces:**
- Consumes: `CurrentPolicyVersions`, `findCurrentAcceptance`, `ensureCurrentAcceptance`.
- Produces:
  ```ts
  export type OnboardingState = {
    complete: boolean;
    age14Confirmed: boolean;
    terms: {
      currentVersion: string;
      accepted: boolean;
      acceptedAt: string | null;
    };
    privacy: {
      currentVersion: string;
      accepted: boolean;
      acceptedAt: string | null;
    };
  };

  export async function getCurrentOnboardingState(input: {
    ownerUserId: string;
    currentPolicies: CurrentPolicyVersions;
  }): Promise<OnboardingState>;

  export async function acceptCurrentOnboarding(input: {
    ownerUserId: string;
    currentPolicies: CurrentPolicyVersions;
    now?: Date;
  }): Promise<OnboardingState>;

  export async function isCurrentOnboardingComplete(
    ownerUserId: string,
  ): Promise<boolean>;
  ```

- [ ] **Step 1: Write failing service tests**

Cover exact cases:
1. matching snapshot → complete true,
2. no snapshot → complete false,
3. old Terms → complete false,
4. old Privacy → complete false,
5. accept uses one server `now` for all three acceptance timestamps,
6. repeated accept returns current complete state,
7. output uses ISO strings and exposes no acceptance-row ID/user ID.

Use dependency injection for repository/config in tests, with production wrappers using real repository/config.

- [ ] **Step 2: Run service tests and verify RED**

Run:
```bash
pnpm vitest run src/services/onboarding-service.test.ts
```
Expected: FAIL because service does not exist.

- [ ] **Step 3: Implement minimal service**

Rules:
- a matching row is the sole source of `complete: true`,
- `age14Confirmed` is true only when the matching row exists,
- accepted timestamps are `toISOString()`,
- old-version rows are not merged together to simulate current completion,
- `isCurrentOnboardingComplete` loads the same production policy config and calls the same current-state logic; it must not duplicate policy checks.

- [ ] **Step 4: Run service tests and verify GREEN**

Run:
```bash
pnpm vitest run src/services/onboarding-service.test.ts
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/services/onboarding-service.ts src/services/onboarding-service.test.ts
git commit -m "feat: add onboarding completion service"
```

---

### Task 4: Authenticated `/api/onboarding` GET/POST

**Files:**
- Create: `app/api/onboarding/route.ts`
- Test: `app/api/onboarding/route.test.ts`

**Interfaces:**
- Consumes: `resolveApiUser`, `apiError`, `jsonNoStore`, `parseJsonBody`, `getCurrentPolicyVersions`, `acceptOnboardingSchema`, onboarding service.
- Produces:
  - `GET /api/onboarding`
  - `POST /api/onboarding`

- [ ] **Step 1: Write failing route-factory tests**

Create an injectable dependency shape:
```ts
export type OnboardingRouteDependencies = {
  resolveUser(request: Request): Promise<{ id: string; displayName: string } | null>;
  getPolicies(): CurrentPolicyVersions;
  getState(input: {
    ownerUserId: string;
    currentPolicies: CurrentPolicyVersions;
  }): Promise<OnboardingState>;
  accept(input: {
    ownerUserId: string;
    currentPolicies: CurrentPolicyVersions;
    now?: Date;
  }): Promise<OnboardingState>;
};
```

Required assertions:
- GET anonymous → 401 `authentication_required`,
- GET authenticated passes only resolved `user.id` as owner,
- GET response is `Cache-Control: no-store`,
- POST all true → 200 complete state,
- POST false/missing → 422 validation issues,
- POST body containing `userId`, `ownerUserId`, `termsVersion`, `privacyVersion`, or timestamps cannot change the owner/version passed to service,
- policy/service failure → 500 `internal_error` with no raw message.

- [ ] **Step 2: Run route tests and verify RED**

Run:
```bash
pnpm vitest run app/api/onboarding/route.test.ts
```
Expected: FAIL because route does not exist.

- [ ] **Step 3: Implement route**

Use a single response function for GET/POST. Resolve session user before reading policy config or body so anonymous callers cannot probe policy/config failures.

For POST:
```ts
const parsedBody = await parseJsonBody(request);
if (!parsedBody.ok) return parsedBody.response;
const parsed = acceptOnboardingSchema.safeParse(parsedBody.value);
if (!parsed.success) {
  return apiError("validation_failed", 422, validationIssues(parsed.error));
}
```

Do not pass `parsed.data` ownership/version values because the schema contains only booleans; the trusted owner and current versions come from server dependencies.

- [ ] **Step 4: Run route tests and verify GREEN**

Run:
```bash
pnpm vitest run app/api/onboarding/route.test.ts
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/api/onboarding/route.ts app/api/onboarding/route.test.ts
git commit -m "feat: expose onboarding acceptance api"
```

---

### Task 5: Cross-user and fail-closed security regression

**Files:**
- Create: `src/onboarding/security-regression.test.ts`
- Modify only if the regression reveals a real defect: onboarding repository/service/route files from Tasks 2-4.

**Interfaces:**
- Verifies existing production boundaries; adds no new public API.

- [ ] **Step 1: Add regression tests**

Use fake stores/dependencies that contain separate `user-a` and `user-b` acceptance rows. Assert:
- A's current-state request never sees B's row,
- a body with `userId: "user-b"` still persists for the resolved `user-a`,
- an old-version acceptance remains incomplete even if another current-version row exists for B,
- config failure cannot accidentally return `complete: true`,
- response bodies do not contain `identitySubject`, raw session token, acceptance row ID, or SQL/config exception text.

- [ ] **Step 2: Run regression and full onboarding tests**

Run:
```bash
pnpm vitest run src/onboarding/security-regression.test.ts src/onboarding src/domain/onboarding.test.ts src/repositories/onboarding-repository.test.ts src/services/onboarding-service.test.ts app/api/onboarding/route.test.ts
```
Expected: PASS. If any test fails, fix only the demonstrated boundary and rerun the same command.

- [ ] **Step 3: Commit**

```bash
git add src/onboarding/security-regression.test.ts
git commit -m "test: lock onboarding ownership boundary"
```

---

### Task 6: Final verification and documentation

**Files:**
- Create or update: `docs/VERIFICATION.md`
- Update: PR #17 body after fresh CI evidence exists.

**Interfaces:**
- Produces repository evidence only; no runtime API changes.

- [ ] **Step 1: Run the exact full verification sequence on the final code HEAD**

Run:
```bash
pnpm install --frozen-lockfile
pnpm db:migrate
pnpm test:run
pnpm build
```
Expected: all PASS.

- [ ] **Step 2: Verify migration ordering against PostgreSQL 16 CI**

Confirm Actions applies:
```text
0000_evidence_vault_initial
0001_deletion_job_idempotency
0002_optional_merchant
0003_onboarding_acceptances
```
without rewriting existing migrations.

- [ ] **Step 3: Record evidence**

Add an ONB-001 section to `docs/VERIFICATION.md` containing:
- final branch/head SHA,
- RED run IDs for each new task where observed,
- final GREEN CI run ID,
- final test file/test counts from logs,
- PostgreSQL migration result,
- production build result,
- explicit unverified items: real browser onboarding flow, production policy text/operator identity, deployed re-consent flow.

- [ ] **Step 4: Review the final PR diff**

Check:
- no DOB/demographic fields,
- no client-owned user/version/timestamp authority,
- no production policy version invented in code,
- no session/config/SQL data in responses,
- no migration renumbering,
- no unrelated dashboard/UI implementation.

- [ ] **Step 5: Commit verification docs**

```bash
git add docs/VERIFICATION.md
git commit -m "docs: record onboarding acceptance verification"
```

- [ ] **Step 6: Run fresh CI on the documentation-inclusive final HEAD**

Expected: PostgreSQL migration, full Vitest suite, and Next.js production build all PASS before PR #17 is marked ready for review.
