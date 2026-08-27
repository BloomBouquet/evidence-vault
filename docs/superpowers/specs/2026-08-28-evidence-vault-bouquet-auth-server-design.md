# Evidence Vault Bouquet Auth Server Design

Date: 2026-08-28
Owner: Backend Agent / Team 해바라기
Task: AUTH-001
Branch: `agent/해바라기/backend/bouquet-auth-server`
Depends on: BE-001

## Goal

Complete the server-side BloomBouquet 꽃다발 SSO integration for Evidence Vault using Authorization Code + PKCE S256, then convert the verified central identity into an Evidence Vault-owned opaque application session.

The project never creates its own email/password credential store and never exposes Bouquet access tokens, authorization codes, PKCE verifiers, or secret values to browser persistent storage or application logs.

## Existing baseline

The repository already contains:

- PKCE verifier/challenge/state generation,
- constant-time state comparison,
- encrypted short-lived OAuth login-attempt state using AES-256-GCM,
- internal-only `returnTo` sanitization,
- DB tables/repository primitives for application sessions.

AUTH-001 extends this baseline rather than replacing it.

## Upstream Bouquet contract

Evidence Vault integrates with the existing central provider routes:

```text
/bloom/?mode=auth
/api/bouquet/oauth/authorize
/api/bouquet/oauth/token
/api/bouquet/oauth/userinfo
```

Authorization request requirements:

- response type: code,
- `client_id`,
- exact registered `redirect_uri`,
- `state`,
- `code_challenge`,
- `code_challenge_method=S256`.

Token exchange is server-to-server and provides:

- `clientId`,
- `code`,
- `redirectUri`,
- `codeVerifier`.

Expected token response:

```json
{
  "access_token": "...",
  "token_type": "Bearer",
  "expires_in": 900
}
```

Userinfo is fetched server-to-server with the access token and is expected to provide:

```json
{
  "sub": "central-subject",
  "email": "optional@example.com",
  "name": "Display Name"
}
```

Evidence Vault treats `sub` as the durable central identity key.

## Evidence Vault route contract

The application owns these routes:

```text
GET  /auth/bouquet/start
GET  /auth/bouquet/callback
GET  /auth/session
POST /auth/sign-out
```

No Evidence Vault route accepts a flower-account email/password credential.

## Authentication flow

```text
GET /auth/bouquet/start?returnTo=/dashboard
  ↓
validate environment config
  ↓
generate state + PKCE verifier/challenge
  ↓
seal { state, verifier, returnTo, expiresAt }
  ↓
set short-lived HttpOnly OAuth-attempt cookie
  ↓
redirect to central /bloom/?mode=auth with OAuth request parameters
  ↓
central provider authenticates the user
  ↓
GET /auth/bouquet/callback?code=...&state=...
  ↓
open and validate OAuth-attempt cookie
  ↓
constant-time state comparison
  ↓
server-side code exchange using PKCE verifier
  ↓
server-side /userinfo request
  ↓
resolve/create Evidence Vault user by identitySubject = sub
  ↓
create opaque Evidence Vault application session
  ↓
set HttpOnly application-session cookie
  ↓
delete OAuth-attempt cookie
  ↓
redirect to sanitized internal returnTo
```

## Environment configuration

Required configuration:

- `APP_BASE_URL`
- `BOUQUET_BASE_URL`
- `BOUQUET_CLIENT_ID`
- `BOUQUET_REDIRECT_URI`
- `SESSION_SECRET`
- `DATABASE_URL`

Rules:

- URLs must parse as HTTP(S) URLs.
- Production application and callback URLs must use HTTPS.
- `SESSION_SECRET` must contain at least 32 bytes of UTF-8 entropy input length as enforced by the current login-attempt module.
- `BOUQUET_REDIRECT_URI` must exactly equal the registered callback URL and must target `/auth/bouquet/callback`.
- Real credentials/secrets are never committed.

## OAuth-attempt cookie

Cookie name:

```text
ev_oauth_attempt
```

Contents: only the encrypted/sealed login-attempt value.

Plaintext logical payload before sealing:

```ts
{
  state: string;
  verifier: string;
  returnTo: string;
  expiresAt: number;
}
```

Cookie policy:

- HttpOnly: true,
- Secure: true in production,
- SameSite: Lax,
- Path: `/auth/bouquet`,
- Max-Age: 600 seconds,
- deleted on callback success or callback failure.

The PKCE verifier is never placed in URL parameters, localStorage, sessionStorage, analytics, client-rendered JSON, or logs.

## Login start

`GET /auth/bouquet/start` accepts only an optional internal `returnTo`.

Behavior:

1. sanitize `returnTo`, defaulting to `/dashboard`,
2. generate state/verifier/challenge,
3. seal the login attempt with expiry now + 10 minutes,
4. set the OAuth-attempt cookie,
5. redirect to the central auth portal.

The portal URL contains:

- `mode=auth`,
- `client_id`,
- `redirect_uri`,
- `state`,
- `code_challenge`,
- `code_challenge_method=S256`.

The portal then uses the upstream `/api/bouquet/oauth/authorize` route as part of the central provider flow. Evidence Vault does not bypass the portal with a project-owned credential form.

## Callback validation

`GET /auth/bouquet/callback` requires:

- query `code`,
- query `state`,
- valid unexpired `ev_oauth_attempt` cookie.

Validation order:

1. require code/state/cookie,
2. decrypt/validate OAuth attempt,
3. constant-time compare query state to stored state,
4. exchange the code exactly once through the provider,
5. fetch userinfo,
6. create project user/session,
7. clear attempt cookie.

Any failure clears the attempt cookie and redirects to a stable product error destination without embedding provider details.

## Provider client behavior

### Token exchange

POST JSON to:

```text
{BOUQUET_BASE_URL}/api/bouquet/oauth/token
```

Body:

```json
{
  "clientId": "configured-client-id",
  "code": "callback-code",
  "redirectUri": "configured-callback-uri",
  "codeVerifier": "server-held-verifier"
}
```

Never log request body or token response.

Normalize any non-success/invalid payload to:

```text
bouquet_token_exchange_failed
```

### Userinfo

GET:

```text
{BOUQUET_BASE_URL}/api/bouquet/oauth/userinfo
```

Header:

```text
Authorization: Bearer <access_token>
```

Never log the Authorization header or access token.

Normalize any non-success/invalid payload to:

```text
bouquet_userinfo_failed
```

Validate at minimum that `sub` and `name` are non-empty strings.

## Local user identity

Evidence Vault stores the minimum identity needed for the application.

Required persisted identity:

- `identitySubject = userinfo.sub`,
- `displayName = userinfo.name`.

Email is not persisted in MVP because Evidence Vault currently has no product requirement that needs it. If a later feature requires email, that change needs an explicit privacy/product decision.

### Existing deleted user

A soft-deleted Evidence Vault account must not be silently reactivated by a new Bouquet login.

Attempted login for an identity whose Evidence Vault user row has `deletedAt != null` returns a stable internal auth failure such as `account_deleted` and does not create an application session.

## Application session

Cookie name:

```text
ev_session
```

Session model:

- generate 32 random bytes and encode base64url as the raw browser token,
- persist only SHA-256 hex hash in `ev_app_sessions.token_hash`,
- bind the session to the local Evidence Vault user,
- default lifetime: 7 days,
- allow explicit revocation,
- reject revoked, expired, or deleted-user sessions.

Cookie policy:

- HttpOnly: true,
- Secure: true in production,
- SameSite: Lax,
- Path: `/`,
- Max-Age aligned with session expiry.

The raw session token is never written to database logs or application logs.

## Session endpoint

`GET /auth/session` is the UI's canonical current-session check.

Anonymous/invalid/expired session returns HTTP 200 with:

```json
{ "user": null }
```

Authenticated session returns HTTP 200 with only product-safe fields:

```json
{
  "user": {
    "id": "local-user-id",
    "displayName": "Display Name"
  }
}
```

Do not return Bouquet access token, PKCE data, application-session hash, central password data, or provider internals.

This endpoint intentionally uses `user: null` rather than a redirect so the Frontend auth client can distinguish initial checking/anonymous state without redirect loops.

## Sign out

`POST /auth/sign-out`:

1. reads the current `ev_session` cookie when present,
2. hashes and revokes the corresponding application session,
3. clears the cookie,
4. returns `{ "success": true }`.

The operation is idempotent: missing/invalid session cookie still results in a cleared cookie and safe success response.

Sign out does not call the central Bouquet logout endpoint and does not delete the central SSO session.

## Callback redirects and error contract

Success redirects to the sanitized internal `returnTo`.

Failure redirects to:

```text
/?auth_error=oauth_failed
```

The browser-visible query value remains coarse and stable. Specific internal errors may be used in server-side test assertions but are not included in the redirect URL or user-facing copy.

No error path may include:

- authorization code,
- state value,
- PKCE verifier,
- access token,
- raw provider body,
- stack trace,
- account-existence detail beyond approved product behavior.

## Onboarding boundary

AUTH-001 authenticates and creates an Evidence Vault session. It does not implement the full onboarding UI.

After authentication, protected application routing may later check whether required age/Terms/Privacy acknowledgements are complete and route to `/onboarding` before evidence workflows. That gate belongs to the relevant product/backend/frontend tasks and must not cause AUTH-001 to store unnecessary profile data.

## Security invariants

The following are objective blockers:

- project-owned email/password form/store,
- verifier in URL/browser persistent storage,
- access token or authorization code in client persistence/logs,
- accepting mismatched OAuth state,
- accepting expired/tampered OAuth-attempt cookie,
- application session stored raw in the database,
- session resolving for a revoked/expired/deleted user,
- unsanitized external/protocol-relative `returnTo`,
- callback redirect URI drift from configured registered URI,
- silent reactivation of deleted local accounts.

## Error handling

Provider/network failure must not fabricate success.

Internal normalized errors include:

- `auth_config_invalid`,
- `oauth_attempt_missing`,
- `oauth_attempt_invalid`,
- `oauth_attempt_expired`,
- `oauth_state_mismatch`,
- `bouquet_token_exchange_failed`,
- `bouquet_userinfo_failed`,
- `account_deleted`,
- `session_creation_failed`.

These are implementation/testing contracts, not necessarily browser-visible messages.

## Testing contract

AUTH-001 must add automated coverage for at least:

### Config

- valid environment,
- missing required value,
- invalid URL,
- production non-HTTPS application/callback URL,
- callback path mismatch,
- short session secret.

### Login start

- generates PKCE/state,
- redirects to central portal with required parameters,
- preserves only sanitized internal returnTo,
- sets short-lived secure-policy attempt cookie.

### Callback

- success path,
- missing code/state/cookie,
- tampered/expired attempt,
- state mismatch,
- token exchange failure,
- userinfo failure,
- deleted local account,
- attempt cookie cleared on success/failure,
- application session created only after verified userinfo.

### Provider client

- correct token endpoint/body,
- correct Bearer userinfo request,
- malformed/non-2xx responses normalized,
- no token value included in thrown errors.

### Application session

- random raw token is distinct from stored hash,
- hash is deterministic 64-character SHA-256 hex,
- valid session resolves user,
- expired session rejected,
- revoked session rejected,
- deleted user rejected,
- sign-out revokes and clears session,
- sign-out is idempotent.

### Regression/security

- external/protocol-relative/backslash returnTo rejected,
- code/verifier/access token never appears in response JSON for session endpoint,
- callback error redirect never includes provider secrets.

## Explicit non-goals for AUTH-001

- Frontend auth-state UI,
- onboarding UI,
- VaultItem authorization APIs,
- object-storage authorization,
- central Bouquet account management,
- refresh-token support,
- social login provider support,
- project-owned password reset/signup/login.

## Acceptance criteria

AUTH-001 is complete when:

- Evidence Vault starts login through central Bouquet SSO using state + PKCE S256,
- callback performs safe server-side code exchange and userinfo verification,
- local user identity is minimal and keyed by `sub`,
- deleted local users are not silently reactivated,
- Evidence Vault creates/revokes its own hashed opaque session,
- `/auth/session` and `/auth/sign-out` satisfy the stable project contract,
- provider secrets never reach browser persistence/logs/user-visible errors,
- automated tests cover success and security/error paths,
- full unit suite and production build pass on the resulting branch.
