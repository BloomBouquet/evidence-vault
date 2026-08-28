# Evidence Vault Onboarding UI and Route Gate Design

Date: 2026-08-28
Owner: Frontend Agent / Team 해바라기
Task: ONBUI-001
Branch: `agent/해바라기/frontend/onboarding-ui`
Depends on: ONB-001, AUTHUI-001, DES-001

## Goal

Implement the first-authenticated-visit privacy/safety gate defined by DES-001 without introducing project-owned credentials or allowing authenticated-but-incomplete users to enter evidence-bearing workflows.

The task owns:

- `/onboarding`,
- public `/terms` and `/privacy` reading surfaces,
- the completion gate used by evidence-bearing protected routes,
- neutral loading/error/retry states around onboarding,
- integration with the existing Evidence Vault session shell.

## Chosen approach

Use **two authorization layers**:

1. application-session authentication — supplied by existing Bouquet auth,
2. current-onboarding completion — supplied by ONB-001.

The current `(protected)` route group becomes the evidence-workflow boundary and requires both. `/onboarding` requires authentication but explicitly does **not** require completed onboarding. `/terms` and `/privacy` remain public so a user can read the documents before logging in or before accepting them.

Rejected alternatives:

- putting `/onboarding` inside the same completed-onboarding layout — creates a redirect loop,
- client-only redirect after page paint — risks protected-content flash and is not a security boundary,
- hiding nav links only — does not protect direct URLs/server-rendered data,
- collecting birth date for the age gate — unnecessary personal data for the approved MVP contract.

## Route responsibilities

```text
/                     public landing
/terms                public Terms document
/privacy              public Privacy Policy document
/onboarding           authenticated session required, onboarding completion not required

/dashboard            authenticated + current onboarding required
/vault/*               authenticated + current onboarding required
/case/*                authenticated + current onboarding required
/account evidence/data controls   authenticated + current onboarding required
```

The exact route-group folder names are implementation details. User-visible paths and authorization behavior above are the contract.

## Server-side gate

Create/consume one server helper equivalent to:

```ts
requireProductUser(): Promise<{ id: string; displayName: string }>
```

Behavior:

1. read `ev_session` on the server,
2. resolve the local Evidence Vault user,
3. if missing/expired, redirect to `/?auth_error=session_required`,
4. ask ONB-001 whether the user's acceptance matches current Terms/Privacy versions,
5. if incomplete/outdated, redirect to `/onboarding`,
6. only then return the product user to the page/layout.

The raw session token is never passed to client components.

The existing protected layout may be refactored to consume this helper, but the shell must not render protected children before the helper succeeds.

## `/onboarding` flow

### Entry

The page requires a valid Evidence Vault session. Anonymous access follows the existing reauthentication path.

On first render the server loads the current onboarding state. If it is already complete, redirect to `/dashboard` instead of showing the form again.

### Content hierarchy

1. heading: explain that three confirmations are required before evidence can be stored,
2. privacy summary: evidence is private by default and unnecessary high-risk identifiers should be redacted,
3. explicit statement that Evidence Vault organizes facts and does not provide legal advice/representation,
4. three required controls:
   - `만 14세 이상입니다`,
   - current Terms agreement with link to `/terms`,
   - current Privacy Policy agreement with link to `/privacy`,
5. primary action: continue to Evidence Vault.

The age control is an acknowledgement only. Copy must not say `나이 인증 완료`, `본인인증`, or otherwise imply formal age/identity verification.

### Submit

The client submits only:

```json
{
  "age14Confirmed": true,
  "termsAccepted": true,
  "privacyAccepted": true
}
```

No user ID, identity subject, acceptance timestamp, or policy version is sent as a trusted value.

On `200 complete=true`, navigate to `/dashboard` and refresh server state.

If the server returns incomplete after a nominal success response, remain on onboarding and show a retryable neutral error rather than assuming completion.

### Error states

- validation: associate field-level message with the unchecked required control,
- 401: use the existing reauthentication path,
- network/500: show `저장하지 못했어요. 다시 시도해 주세요.` with retry,
- policy configuration unavailable: show a neutral unavailable state; never show raw version/config values beyond the public current version identifier already supplied by the API.

The page must never render SQL/provider/session/internal errors.

## Re-consent behavior

When the configured current Terms or Privacy version changes, an existing user with only older acceptance is incomplete again.

On their next evidence-workflow navigation:

- the server gate redirects to `/onboarding`,
- the page clearly states that the policy changed and requires current agreement,
- the user can open the current document before accepting,
- historical acceptance remains backend data and is not presented as a user-editable record.

Do not delete or rewrite old acceptance history during re-consent.

## Terms and Privacy document surfaces

### Public readability

`/terms` and `/privacy` are readable without authentication. They use the existing document-oriented design system and do not include Evidence Vault credential inputs.

### Version coupling

Each page renders the same current version identifier consumed by ONB-001. The acceptance UI must never show a version different from the version the backend records.

### No fabricated legal identity data

Operator/legal identity fields must come from verified deployment configuration or a separately approved repository-owned value. This task must not invent:

- operator/company name,
- representative name,
- business registration number,
- postal address,
- email/phone privacy contact,
- hosting/storage legal entity claims.

If required production policy identity configuration is not available, release/deployment readiness remains blocked. Tests may inject explicit fixture identity values; fixtures must not be presented as production facts.

### Content boundary

Terms/Privacy can describe the approved product behavior, including:

- factual evidence organization,
- private-by-default storage,
- evidence/file metadata used by the product,
- session/auth behavior,
- deletion/reconciliation behavior,
- no individualized legal advice or representation,
- no sale of claims that stored SHA-256 proves authenticity/admissibility.

This task does not make new legal promises beyond actual implemented product behavior.

## Navigation shell behavior

After onboarding completes, protected navigation remains compact and document-first.

During onboarding:

- do not show links that appear to grant access to `/dashboard`, `/vault/*`, or `/case/*` as usable product navigation,
- provide only brand/home context, Terms/Privacy links, and project sign-out when appropriate.

After completion, existing protected navigation can render normally.

## Accessibility and responsive contract

- visible labels for all three required controls,
- group explanatory text with the controls semantically,
- validation errors programmatically associated,
- submit target at least 44px high,
- keyboard-only completion possible,
- focus moves to validation summary/first invalid control after failed submit when appropriate,
- loading/saving has textual status and prevents duplicate submit,
- no state communicated by color alone,
- 320px layout has no horizontal scrolling,
- Terms/Privacy long text remains readable at 200% zoom,
- reduced-motion settings are respected through existing primitives.

## Data-flow boundary

```text
server page
  → resolve Evidence Vault session
  → GET/current onboarding service state
  → already complete? redirect /dashboard
  → render form with public current policy versions

client submit
  → POST /api/onboarding
  → server derives owner/current versions/timestamps
  → 200 complete=true
  → router.replace('/dashboard') + refresh
  → protected layout rechecks server state
```

The final protected transition is revalidated by the server; successful client state alone never authorizes the dashboard.

## Testing strategy

Implementation follows RED → observed RED → minimal GREEN → full GREEN.

Required automated coverage:

1. anonymous `/onboarding` follows session-required recovery,
2. authenticated incomplete user can render onboarding,
3. authenticated complete user is redirected away from onboarding,
4. incomplete/outdated user cannot render protected dashboard children,
5. current complete user can render protected children,
6. submit body contains only the three acknowledgements,
7. all required acknowledgements must be checked,
8. success navigates to `/dashboard` and refreshes,
9. 401/network/500 paths expose retry/recovery without internal details,
10. Terms/Privacy links are keyboard accessible and public,
11. policy document UI uses the same current version source as acceptance,
12. no email/password inputs or Web Storage auth persistence are introduced,
13. no raw `ev_session` value is passed to client-rendered props,
14. responsive/style contracts cover narrow screens and target sizes,
15. full unit suite and production build pass.

Manual QA remains required later for real browser 320px, 200% zoom, keyboard traversal, screen reader, and deployed Bouquet → onboarding → dashboard flow.

## Explicit non-goals

- no date-of-birth collection,
- no formal identity/age verification,
- no parental-consent feature,
- no dashboard/Vault CRUD implementation,
- no case/export UI,
- no central Bouquet password-management UI,
- no production deployment claim before verified operator/policy configuration exists.

## Acceptance criteria

ONBUI-001 is ready for integration when:

- `/onboarding` is authenticated but not self-blocked by the completion gate,
- `/terms` and `/privacy` are publicly readable,
- evidence-bearing protected routes fail closed for missing/outdated acceptance,
- protected content cannot flash before server authorization,
- acceptance uses only ONB-001's current-version server contract,
- no production legal identity fields are fabricated,
- automated auth/onboarding/accessibility contracts and production build pass,
- browser/deployment checks not actually performed remain explicitly unclaimed.
