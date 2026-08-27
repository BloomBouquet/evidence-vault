# Evidence Vault Bouquet Auth Server Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete Evidence Vault server-side 꽃다발 Authorization Code + PKCE S256 login, minimal local identity linking, and hashed opaque application sessions.

**Architecture:** Reuse the existing PKCE and AES-256-GCM login-attempt primitives. Add a strict auth config parser, a server-only Bouquet HTTP client, a minimal user repository, an application-session service, and four Next.js route handlers. OAuth provider credentials remain server-only; browser state is represented only by short-lived HttpOnly OAuth-attempt and application-session cookies.

**Tech Stack:** Next.js 16 App Router route handlers, TypeScript, Node `crypto`, PostgreSQL, Drizzle ORM, Vitest.

**Spec:** `docs/superpowers/specs/2026-08-28-evidence-vault-bouquet-auth-server-design.md`

## Global Constraints

- No project-owned email/password credential store or form.
- OAuth uses Authorization Code + PKCE S256.
- OAuth attempt cookie name is `ev_oauth_attempt`, HttpOnly, SameSite=Lax, Path=`/auth/bouquet`, Max-Age=600; Secure in production.
- Application-session cookie name is `ev_session`, HttpOnly, SameSite=Lax, Path=`/`; Secure in production.
- `BOUQUET_REDIRECT_URI` must point to `/auth/bouquet/callback` and exactly match the registered URI used in token exchange.
- Production `APP_BASE_URL`, `BOUQUET_BASE_URL`, and `BOUQUET_REDIRECT_URI` must use HTTPS.
- Only `userinfo.sub` and `userinfo.name` are persisted for MVP; email is not persisted.
- Application raw session tokens are 32 random bytes encoded base64url; only SHA-256 hex hashes are persisted.
- Provider token/code/verifier/secret values never appear in client JSON, persistent browser storage, application logs, or user-visible error redirects.
- `GET /auth/session` is the explicit auth-state probe and returns `200 {"user":null}` for anonymous/invalid/expired application session; later protected business APIs use their own stable 401/403 contract.
- Deleted Evidence Vault users are never silently reactivated.
- Production code changes follow RED → verify RED → minimal GREEN → verify GREEN → refactor.

---

### Task 1: Auth configuration contract

**Files:**
- Create: `src/auth/config.ts`
- Test: `src/auth/config.test.ts`

**Interfaces:**
- Produces: `getAuthConfig(env?: NodeJS.ProcessEnv): AuthConfig`.
- Produces type: `AuthConfig = { appBaseUrl: URL; bouquetBaseUrl: URL; bouquetClientId: string; bouquetRedirectUri: URL; sessionSecret: string; secureCookies: boolean }`.
- Throws stable `Error("auth_config_invalid")` for invalid/missing configuration.

- [ ] **Step 1: Write failing configuration tests**

Cover: valid development config; missing required value; malformed URL; short secret; redirect path not `/auth/bouquet/callback`; production HTTP in app/provider/callback URL.

- [ ] **Step 2: Run focused tests and verify RED**

Run: `pnpm vitest run src/auth/config.test.ts`

Expected: FAIL because `src/auth/config.ts` does not exist.

- [ ] **Step 3: Implement strict parser**

Parse `APP_BASE_URL`, `BOUQUET_BASE_URL`, `BOUQUET_CLIENT_ID`, `BOUQUET_REDIRECT_URI`, `SESSION_SECRET`. Reject blank values, non-HTTP(S) protocols, callback path mismatch, production non-HTTPS URLs, and secrets under 32 UTF-8 bytes. `secureCookies` is true only when `NODE_ENV === "production"`.

- [ ] **Step 4: Run focused and full tests**

Run: `pnpm vitest run src/auth/config.test.ts && pnpm test:run`

Expected: PASS.

- [ ] **Step 5: Commit**

Commit: `feat: add bouquet auth config contract`.

---

### Task 2: Server-only Bouquet provider client

**Files:**
- Create: `src/auth/bouquet-client.ts`
- Test: `src/auth/bouquet-client.test.ts`

**Interfaces:**
- Consumes: `AuthConfig`.
- Produces: `buildBouquetPortalUrl(config, input: { state: string; challenge: string }): URL`.
- Produces: `exchangeBouquetCode(config, input: { code: string; verifier: string }, fetchImpl?: typeof fetch): Promise<{ accessToken: string; expiresIn: number }>`.
- Produces: `fetchBouquetUserInfo(config, accessToken: string, fetchImpl?: typeof fetch): Promise<{ sub: string; name: string }>`.
- Normalized errors: `bouquet_token_exchange_failed`, `bouquet_userinfo_failed`.

- [ ] **Step 1: Write failing provider-client tests**

Assert portal URL contains `mode=auth`, client ID, exact redirect URI, state, challenge, and `S256`; token request uses configured `/api/bouquet/oauth/token` JSON contract; userinfo uses Bearer header; malformed/non-2xx payloads normalize without embedding token/code/body values.

- [ ] **Step 2: Run focused tests and verify RED**

Run: `pnpm vitest run src/auth/bouquet-client.test.ts`

Expected: FAIL because module does not exist.

- [ ] **Step 3: Implement minimum provider client**

Use `fetch` only from server-side code. Validate token response as non-empty `access_token`, optional positive `expires_in`; validate userinfo as non-empty `sub` and `name`. Return only `sub/name` to callers; ignore provider email.

- [ ] **Step 4: Run focused and full tests**

Run: `pnpm vitest run src/auth/bouquet-client.test.ts && pnpm test:run`

Expected: PASS.

- [ ] **Step 5: Commit**

Commit: `feat: add bouquet provider client`.

---

### Task 3: Minimal user identity repository

**Files:**
- Create: `src/repositories/user-repository.ts`
- Test: `src/repositories/user-repository.test.ts`

**Interfaces:**
- Produces: `upsertActiveUserByIdentity(input: { identitySubject: string; displayName: string }): Promise<{ id: string; identitySubject: string; displayName: string }>`.
- If an existing matching user has `deletedAt != null`, throws `Error("account_deleted")` and performs no update/session creation.

- [ ] **Step 1: Write failing repository contract tests**

Use a dependency-injected/internal helper boundary so tests can prove: new identity creates a user; active identity updates display name; deleted identity throws and is not reactivated. Do not add email persistence.

- [ ] **Step 2: Run focused tests and verify RED**

Run: `pnpm vitest run src/repositories/user-repository.test.ts`

Expected: FAIL because repository module does not exist.

- [ ] **Step 3: Implement minimal Drizzle repository**

Select by `users.identitySubject`; if deleted, throw `account_deleted`; if active, update only `displayName/updatedAt`; otherwise insert `identitySubject/displayName`.

- [ ] **Step 4: Run focused and full tests**

Run: `pnpm vitest run src/repositories/user-repository.test.ts && pnpm test:run`

Expected: PASS.

- [ ] **Step 5: Commit**

Commit: `feat: add bouquet identity repository`.

---

### Task 4: Opaque application-session service

**Files:**
- Create: `src/auth/project-session.ts`
- Test: `src/auth/project-session.test.ts`
- Reuse: `src/repositories/session-repository.ts`

**Interfaces:**
- Produces: `hashSessionToken(rawToken: string): string`.
- Produces: `createProjectSession(userId: string, now?: Date): Promise<{ rawToken: string; expiresAt: Date }>`.
- Produces: `resolveProjectSession(rawToken: string | null | undefined, now?: Date): Promise<{ id: string; displayName: string } | null>`.
- Produces: `revokeProjectSession(rawToken: string | null | undefined): Promise<void>`.
- Session lifetime: exactly 7 days from creation.

- [ ] **Step 1: Write failing session-service tests**

Assert 32-byte random base64url raw token, deterministic 64-char lower-case SHA-256 hash, DB create receives hash not raw token, valid resolve returns only local `id/displayName`, expired/revoked/deleted sessions resolve null through repository result, and revoke is safe for missing token.

- [ ] **Step 2: Run focused tests and verify RED**

Run: `pnpm vitest run src/auth/project-session.test.ts`

Expected: FAIL because module does not exist.

- [ ] **Step 3: Implement minimum session service**

Generate with `randomBytes(32).toString("base64url")`; hash with SHA-256 hex; call existing `createSessionRecord/findActiveSessionByHash/revokeSessionByHash` only with hashes.

- [ ] **Step 4: Run focused and full tests**

Run: `pnpm vitest run src/auth/project-session.test.ts && pnpm test:run`

Expected: PASS.

- [ ] **Step 5: Commit**

Commit: `feat: add opaque project sessions`.

---

### Task 5: Login-start route

**Files:**
- Create: `app/auth/bouquet/start/route.ts`
- Test: `app/auth/bouquet/start/route.test.ts`

**Interfaces:**
- Consumes: config, `generatePkce`, `sealLoginAttempt`, `sanitizeReturnTo`, `buildBouquetPortalUrl`.
- Produces: GET redirect response and `ev_oauth_attempt` cookie.

- [ ] **Step 1: Write failing route tests**

Assert internal `returnTo` is preserved; external/protocol-relative/backslash values become `/dashboard`; portal redirect includes state/challenge but not verifier; cookie is HttpOnly/Lax/Path `/auth/bouquet`/Max-Age 600 and Secure under production config.

- [ ] **Step 2: Verify RED**

Run: `pnpm vitest run app/auth/bouquet/start/route.test.ts`

Expected: FAIL because route does not exist.

- [ ] **Step 3: Implement route**

Use `NextResponse.redirect`; seal expiry as `Date.now() + 600_000`; never serialize verifier into redirect URL or response body.

- [ ] **Step 4: Run focused and full tests**

Run: `pnpm vitest run app/auth/bouquet/start/route.test.ts && pnpm test:run`

Expected: PASS.

- [ ] **Step 5: Commit**

Commit: `feat: add bouquet login start route`.

---

### Task 6: Callback route

**Files:**
- Create: `app/auth/bouquet/callback/route.ts`
- Test: `app/auth/bouquet/callback/route.test.ts`

**Interfaces:**
- Consumes: login-attempt open/state comparison, provider client, user repository, project-session service.
- Produces: success redirect to sanitized returnTo with `ev_session`; failure redirect `/?auth_error=oauth_failed` with attempt cookie cleared.

- [ ] **Step 1: Write failing callback tests**

Cover success; missing code/state/cookie; tampered/expired attempt; state mismatch; token failure; userinfo failure; deleted account; session created only after verified userinfo; attempt cookie cleared on both success/failure; error redirect never contains code/state/verifier/token/provider body.

- [ ] **Step 2: Verify RED**

Run: `pnpm vitest run app/auth/bouquet/callback/route.test.ts`

Expected: FAIL because route does not exist.

- [ ] **Step 3: Implement callback route**

On success: validate → exchange → userinfo → upsert active user → create local session → set `ev_session` → clear attempt cookie → internal redirect. On any handled auth failure: clear attempt cookie and coarse redirect only.

- [ ] **Step 4: Run focused and full tests**

Run: `pnpm vitest run app/auth/bouquet/callback/route.test.ts && pnpm test:run`

Expected: PASS.

- [ ] **Step 5: Commit**

Commit: `feat: add bouquet oauth callback route`.

---

### Task 7: Session probe and project sign-out routes

**Files:**
- Create: `app/auth/session/route.ts`
- Create: `app/auth/sign-out/route.ts`
- Test: `app/auth/session/route.test.ts`
- Test: `app/auth/sign-out/route.test.ts`

**Interfaces:**
- `GET /auth/session`: `200 { user: null }` or `200 { user: { id, displayName } }`.
- `POST /auth/sign-out`: idempotent `200 { success: true }`, revokes when possible, clears `ev_session`.

- [ ] **Step 1: Write failing route tests**

Assert session JSON never contains provider token/code/verifier/session hash; invalid/missing session returns user null; valid returns safe user; sign-out revokes hash-backed session and clears cookie; missing cookie is still success.

- [ ] **Step 2: Verify RED**

Run: `pnpm vitest run app/auth/session/route.test.ts app/auth/sign-out/route.test.ts`

Expected: FAIL because routes do not exist.

- [ ] **Step 3: Implement routes**

Read `ev_session` only server-side; use project-session service; emit no redirects from session probe.

- [ ] **Step 4: Run focused and full tests**

Run: `pnpm vitest run app/auth/session/route.test.ts app/auth/sign-out/route.test.ts && pnpm test:run`

Expected: PASS.

- [ ] **Step 5: Commit**

Commit: `feat: add project session routes`.

---

### Task 8: Final auth verification and documentation alignment

**Files:**
- Modify only if needed: `.env.example`
- Modify: `docs/VERIFICATION.md`

**Interfaces:**
- Produces fresh verification evidence for AUTH-001.

- [ ] **Step 1: Run full unit suite**

Run: `pnpm test:run`

Expected: 0 failures.

- [ ] **Step 2: Run production build**

Run: `pnpm build`

Expected: exit 0 with all auth route modules type-checking.

- [ ] **Step 3: Review secret exposure and route contract**

Search repository diff for accidental `access_token`, callback codes, verifier values, raw session tokens, real secret values, project-owned email/password form/storage, and external returnTo acceptance. Findings are fixed before completion; do not document sample real credentials.

- [ ] **Step 4: Update verification evidence**

Record exact final GitHub Actions run/test count/build result and explicitly note that a real central provider end-to-end browser login remains a deployment/QA gate until registered client/config/provider runtime are available.

- [ ] **Step 5: Commit**

Commit: `docs: verify bouquet auth server flow`.

## Self-Review

- Spec coverage: configuration, login start, provider token/userinfo, minimal local identity, deleted-user handling, opaque hashed session, callback, session probe, sign-out, stable coarse error handling, secret boundaries, and automated verification all map to Tasks 1–8.
- Placeholder scan: no TBD/TODO/unspecified implementation steps remain.
- Type consistency: route tasks consume the exact config/provider/user/session interfaces defined in Tasks 1–4.
- Scope: Frontend auth-state UI and onboarding remain excluded and are handled by later AUTHUI/product tasks.

## Execution Handoff

Execution mode: **Inline Execution** because this ChatGPT session cannot dispatch actual isolated subagent processes. Each Task still uses a separate RED/GREEN/CI checkpoint and is not considered complete based only on implementation claims.