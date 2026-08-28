# Evidence Vault Onboarding Acceptance Backend Design

Date: 2026-08-28
Owner: Backend Agent / Team 해바라기
Task: ONB-001
Branch: `agent/해바라기/backend/onboarding-acceptance`
Depends on: PM-002, AUTH-001

## Goal

Add the missing server-enforced onboarding acceptance state required by DES-001. A valid 꽃다발/Evidence Vault application session proves identity only; it must not by itself authorize access to evidence-bearing product workflows.

ONB-001 records only the minimum acknowledgements needed for the MVP gate:

- the user explicitly confirms they are 14 years of age or older,
- the user accepts the current Terms version,
- the user accepts the current Privacy Policy version.

Evidence Vault does not collect date of birth, resident-registration number, phone number, address, or other demographic data for this gate.

## Chosen approach

Use an **append-only onboarding completion snapshot** per user and Terms/Privacy version pair.

Rejected alternatives:

1. Boolean columns directly on `ev_users` — rejected because they lose policy-version history and make future re-consent ambiguous.
2. Separate policy-acceptance and age tables — semantically pure but unnecessarily complex for the MVP when all three acknowledgements are required together.
3. Browser-only acceptance flags — rejected because protected server routes could not enforce the gate and local state would be forgeable/clearable independently of the account.

The append-only snapshot preserves historical evidence of which policy versions were accepted without storing unnecessary personal data.

## Data model

Add `ev_onboarding_acceptances`:

- `id` UUID primary key,
- `user_id` UUID, required FK to `ev_users`, cascade on account deletion,
- `age_14_confirmed_at` timestamptz, required,
- `terms_version` varchar(64), required,
- `terms_accepted_at` timestamptz, required,
- `privacy_version` varchar(64), required,
- `privacy_accepted_at` timestamptz, required,
- `created_at` timestamptz, required/default now.

Add a unique index on:

`(user_id, terms_version, privacy_version)`.

For the same current version pair, a repeated successful submission is idempotent: return the existing completion state rather than create duplicate acceptance rows.

When either current policy version changes, the old snapshot remains historical but no longer satisfies current onboarding completeness. A new accepted snapshot is required.

## Current policy version source

Current Terms and Privacy version identifiers are server-owned configuration, not client input.

Define a small server policy config interface equivalent to:

```ts
type CurrentPolicyVersions = {
  termsVersion: string;
  privacyVersion: string;
};
```

Production code reads these values from verified server configuration. Tests inject explicit values.

Rules:

- non-empty version strings, max 64 characters,
- client requests cannot choose or override versions,
- if current policy versions are unavailable or invalid, onboarding cannot be marked complete,
- configuration failures normalize to `internal_error`; raw environment/configuration data is never returned to the browser.

The initial production values are not invented by this task. They must match the actual Terms/Privacy documents committed and approved for deployment.

## Server domain contract

Create an onboarding service/repository boundary with these responsibilities:

### `getCurrentOnboardingState`

Input:

```ts
{
  ownerUserId: string;
  currentPolicies: CurrentPolicyVersions;
}
```

Output:

```ts
{
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
}
```

The state is complete only when one owner-scoped acceptance snapshot matches both current policy versions and contains all required timestamps.

### `acceptCurrentOnboarding`

Trusted input contains only the authenticated local user ID, current server policy versions, and server time. The service inserts or resolves the snapshot atomically/idempotently.

Client-supplied `userId`, `ownerUserId`, `termsVersion`, `privacyVersion`, timestamps, or identity subject are never trusted.

## API contract

### `GET /api/onboarding`

Authentication:

- resolve the Evidence Vault user from `ev_session`,
- missing/expired session → `401 { "error": "authentication_required" }`.

Success:

```json
{
  "onboarding": {
    "complete": false,
    "age14Confirmed": false,
    "terms": {
      "currentVersion": "<server-version>",
      "accepted": false,
      "acceptedAt": null
    },
    "privacy": {
      "currentVersion": "<server-version>",
      "accepted": false,
      "acceptedAt": null
    }
  }
}
```

The literal version values come from server configuration; the shape above is illustrative, not a production version declaration.

### `POST /api/onboarding`

Accepted request body:

```json
{
  "age14Confirmed": true,
  "termsAccepted": true,
  "privacyAccepted": true
}
```

Rules:

- all three values must be exactly `true`,
- unknown ownership/version/timestamp fields are ignored or rejected by the Zod contract and never influence persistence,
- false/missing acknowledgements → `422 { "error": "validation_failed", "issues": [...] }`,
- anonymous/expired session → `401 authentication_required`,
- persistence/configuration failure → stable `500 internal_error`,
- success → `200` with current onboarding state and `complete: true`.

All authenticated onboarding JSON responses use `Cache-Control: no-store`.

## Ownership and privacy boundary

All reads/writes are owner scoped from the server session.

Required negative behavior:

- User A cannot read User B acceptance history/state by sending an ID in query/body data.
- User A cannot create an acceptance row owned by User B.
- API DTOs do not expose `identitySubject`, another user's ID, raw session token, or internal row IDs unless an ID is needed for a later product contract; ONB-001 does not require exposing acceptance-row IDs.
- No age/birth inference is performed. `age14Confirmed` means only that the user checked the acknowledgement.
- The UI/backend must not describe this acknowledgement as formal identity or legal-age verification.

## Protected-route integration contract for consumers

ONB-001 exposes a server-only helper/service that ONBUI-001 can consume to ask:

```ts
isCurrentOnboardingComplete(ownerUserId): Promise<boolean>
```

This helper must use the same current policy configuration and repository logic as `/api/onboarding`; route gates must not duplicate separate acceptance logic.

ONB-001 itself does not restructure UI route groups. ONBUI-001 owns the route/layout integration.

## Migration contract

The current migration sequence on `develop` is:

```text
0000_evidence_vault_initial
0001_deletion_job_idempotency
0002_optional_merchant
```

ONB-001 adds the next migration as `0003_onboarding_acceptances` and appends the matching Drizzle journal entry. Existing migrations are never renumbered or rewritten.

CI must apply the complete committed migration sequence to PostgreSQL before tests/build are considered green.

## Error handling

Stable external errors are limited to product-safe codes:

- `authentication_required`,
- `validation_failed`,
- `internal_error`.

Database constraint details, SQL, stack traces, environment variables, session values, and policy-config internals are not rendered.

Repeated successful acceptance of the same current policy pair is not an error.

## Testing strategy

Implementation must follow RED → observed RED → minimal GREEN → full GREEN.

Required automated coverage:

1. migration contract includes `0003_onboarding_acceptances` after 0002,
2. current acceptance snapshot returns complete,
3. missing snapshot returns incomplete,
4. old Terms version returns incomplete,
5. old Privacy version returns incomplete,
6. repeated acceptance of the same version pair is idempotent,
7. POST rejects any acknowledgement not exactly true,
8. API derives owner from server session,
9. client-supplied owner/version/timestamp fields cannot change ownership/version persistence,
10. User A cannot read/write User B state,
11. authenticated responses use no-store,
12. configuration/database failures normalize without sensitive details,
13. frozen-lockfile install, PostgreSQL migration, full unit suite, and production build pass.

A real browser acceptance flow is not claimed by ONB-001; ONBUI-001/QA own that evidence.

## Explicit non-goals

- no date-of-birth collection,
- no government identity verification,
- no parental-consent workflow,
- no project-owned login/password changes,
- no marketing-profile fields,
- no legal opinion on age capacity or contract validity,
- no account deletion UI,
- no dashboard/vault UI implementation.

## Acceptance criteria

ONB-001 is ready for integration when:

- the append-only versioned acceptance model is migrated after 0002,
- `/api/onboarding` GET/POST use only the authenticated local owner,
- incomplete/outdated acceptance is distinguishable from complete current acceptance,
- repeated current acceptance is idempotent,
- the server-only completeness helper is reusable by ONBUI-001,
- cross-user and sensitive-data regression tests pass,
- PostgreSQL migration, complete automated tests, and production build are green,
- no claim is made that the checkbox is formal age/identity verification.
