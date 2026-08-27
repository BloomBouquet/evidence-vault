# Evidence Vault Auth UI Design

Date: 2026-08-28
Owner: Frontend Agent / Team 해바라기
Task: AUTHUI-001
Branch: `agent/해바라기/frontend/auth-ui`
Depends on: DES-001, DS-001, AUTH-001

## Goal

Connect the public Evidence Vault landing page to the completed 꽃다발 server authentication flow and establish a reusable authenticated UI boundary without implementing the full onboarding or business dashboard.

The UI must make authentication state explicit, must never render a project-owned email/password form, and must not flash protected application content before the server has validated the Evidence Vault application session.

## Upstream contracts

AUTHUI-001 consumes the merged AUTH-001 routes:

```text
GET  /auth/bouquet/start?returnTo=<internal path>
GET  /auth/bouquet/callback
GET  /auth/session
POST /auth/sign-out
```

`GET /auth/session` returns exactly one of:

```json
{ "user": null }
```

or:

```json
{
  "user": {
    "id": "local-user-id",
    "displayName": "Display Name"
  }
}
```

The browser never receives the Bouquet access token, PKCE verifier, authorization code, application-session hash, or provider error body.

## Chosen architecture

Use a two-layer auth UI boundary:

1. **Public/session-aware layer** — a small client provider calls `/auth/session` once and exposes `checking`, `anonymous`, `authenticated`, or `error` state to landing actions.
2. **Protected/server layer** — the App Router protected route-group layout reads the HttpOnly `ev_session` cookie server-side and calls the existing project-session resolver before rendering children. Anonymous/expired sessions are redirected back to the landing recovery state before protected content is emitted.

This deliberately avoids making a client-side auth context the security boundary. Client session state improves UX; the server layout remains the protection boundary.

## Public landing behavior

The existing landing content and visual identity remain intact.

Hard-coded legacy links to `/auth/login` are removed.

### Checking session

While `/auth/session` is in flight:

- do not show authenticated-only labels,
- render a neutral disabled/checking action such as `로그인 상태 확인 중`,
- keep the public landing content visible because it contains no private user data.

### Anonymous

Render:

- top navigation action: `꽃다발로 로그인`,
- hero primary action: `꽃다발로 시작하기`,
- both link to `/auth/bouquet/start?returnTo=/dashboard`.

No email/password input is added.

### Authenticated

Render:

- top navigation action: `증빙함 열기`,
- hero primary action: `내 증빙함 열기`,
- destination `/dashboard`.

The landing page may display the authenticated user's display name only inside the auth action area; no provider email or central-account details are shown.

### Session-probe error

If `/auth/session` fails or returns malformed JSON:

- show `로그인 상태를 확인하지 못했어요.`,
- provide `다시 확인` without reloading the whole page,
- keep a direct `꽃다발로 로그인` recovery link available,
- do not surface raw network/provider errors.

## Callback error recovery

The landing page handles the stable query contract from AUTH-001.

For `auth_error=oauth_failed`:

- title: `로그인을 완료하지 못했어요.`,
- body: neutral retry guidance,
- primary recovery link: `/auth/bouquet/start?returnTo=/dashboard`,
- secondary action returns to `/` without the error query.

For `auth_error=session_required`:

- title: `로그인이 필요해요.`,
- explain that the requested Evidence Vault screen requires a current project session,
- provide the same 꽃다발 login recovery action.

Unknown `auth_error` values are not rendered verbatim and fall back to the generic login failure copy.

## Protected route boundary

Create an App Router route group for protected application screens.

The protected layout:

1. reads `ev_session` through `next/headers` cookies,
2. resolves the application session on the server,
3. if no active user exists, redirects to `/?auth_error=session_required`,
4. if a user exists, renders the protected shell and its children.

The protected shell may render the local display name and project sign-out action. It must not expose the raw session token.

Future onboarding/dashboard/vault/case routes can live under this route group without duplicating the base authentication check. Additional authorization remains the responsibility of each future backend/data workflow.

## Minimal dashboard handoff screen

AUTHUI-001 creates `/dashboard` only as an authenticated handoff surface so the completed login flow does not end in a 404 before FE-001 lands.

The screen must not fabricate dashboard data, counts, deadlines, or empty-state claims. It only states that the Evidence Vault session is active and that the evidence workspace is the next product surface.

FE-001 will replace this handoff content with the real dashboard work queue.

## Project sign out

The protected shell includes `로그아웃`.

Behavior:

1. POST `/auth/sign-out`,
2. disable the control and expose busy state while pending,
3. on success navigate to `/`,
4. on failure keep the protected page visible and show neutral retryable copy,
5. never claim the central 꽃다발 SSO session was ended.

Sign out changes only the Evidence Vault application session.

## Accessibility and responsive contract

- Existing DS-001 primitives remain the default controls/notices/loading states.
- Authentication status text is not communicated only by color.
- Checking/busy actions expose disabled/`aria-busy` semantics where applicable.
- Retry and sign-out actions remain keyboard operable.
- Primary actions remain at least 44px high via existing primitives/styles.
- 320px width must not introduce horizontal scrolling from auth notices or action groups.
- Focus remains visible.
- Error copy is concise and does not include sensitive provider internals.

## Security/privacy invariants

AUTHUI-001 is blocked if any implementation:

- adds Evidence Vault email/password login fields,
- stores auth/session/provider values in localStorage or sessionStorage,
- renders protected children before the server session check,
- includes raw provider errors in UI copy,
- sends the user to an external `returnTo`,
- exposes `ev_session` to JavaScript,
- claims Evidence Vault sign-out also signs out the central Bouquet account.

## Testing contract

Automated tests cover at least:

- valid anonymous `/auth/session` response,
- valid authenticated `/auth/session` response,
- malformed/non-2xx session probe normalization,
- checking → anonymous/authenticated transitions,
- retry after session-probe failure,
- anonymous landing actions target the Bouquet start route,
- authenticated actions target `/dashboard`,
- callback error copy never includes raw query/provider values,
- sign-out pending/success/failure behavior,
- protected server helper returns authenticated local user or null without exposing token values,
- full unit suite and production build.

Browser QA remains required later for real provider redirect/callback behavior, 320px layout, keyboard traversal, and focus behavior in the deployed-equivalent flow.

## Explicit non-goals

- full onboarding persistence/UI,
- real dashboard data,
- VaultItem CRUD,
- case/evidence/export pages,
- central Bouquet account/password management,
- refresh token support,
- global client-side user cache beyond the public landing session-aware provider.

## Acceptance criteria

AUTHUI-001 is complete when:

- the landing no longer points to the removed `/auth/login` route,
- anonymous users can start Bouquet login from both primary landing entry points,
- authenticated users can reach `/dashboard`,
- login/session errors have neutral recovery UI,
- protected `/dashboard` content is server-gated before render,
- Evidence Vault project sign-out works with busy/error recovery,
- no project-owned credential form or browser-persistent auth secret is introduced,
- unit tests and production build pass.
