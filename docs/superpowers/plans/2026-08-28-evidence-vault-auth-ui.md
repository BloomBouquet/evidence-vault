# Evidence Vault Auth UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Connect the public landing UI to the merged Bouquet authentication routes, add session-aware entry actions, establish a server-gated protected route boundary, and provide Evidence Vault project sign-out without implementing the full dashboard.

**Architecture:** A small client session provider consumes `GET /auth/session` only for public landing UX. Protected routes do not trust that client state: an App Router server layout reads the HttpOnly `ev_session` cookie and resolves the application session before rendering children. A minimal `/dashboard` handoff page proves the completed login path without fabricating product data.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Vitest, Testing Library, existing DS-001 UI primitives.

**Spec:** `docs/superpowers/specs/2026-08-28-evidence-vault-auth-ui-design.md`

## Global Constraints

- Never add project-owned email/password login fields or credential storage.
- Never persist provider/session/auth values to localStorage or sessionStorage.
- Anonymous landing login URL is `/auth/bouquet/start?returnTo=/dashboard`.
- `/auth/session` is the public UI session-state source of truth and returns only `user: null` or `{ id, displayName }`.
- Protected route children render only after server-side project-session validation.
- Protected anonymous/expired sessions redirect to `/?auth_error=session_required`.
- `auth_error=oauth_failed` renders neutral recovery copy and never raw query/provider details.
- Evidence Vault sign-out POSTs `/auth/sign-out` and does not claim to end central Bouquet SSO.
- Full dashboard/onboarding/data workflows remain out of scope.
- Production changes use RED → observed RED → minimal GREEN → full GREEN → review.

---

### Task 1: Client session-probe contract

**Files:**
- Create: `src/auth/client-session.ts`
- Test: `src/auth/client-session.test.ts`

**Interfaces:**
- Produces type `PublicSessionUser = { id: string; displayName: string }`.
- Produces type `SessionProbeResult = { status: "anonymous" } | { status: "authenticated"; user: PublicSessionUser }`.
- Produces `probeSession(fetchImpl?: typeof fetch): Promise<SessionProbeResult>`.
- Throws only `Error("session_probe_failed")` for non-2xx, malformed JSON, or invalid user fields.

- [ ] **Step 1: Write failing probe tests**

```ts
import { describe, expect, it, vi } from "vitest";
import { probeSession } from "./client-session";

describe("probeSession", () => {
  it("maps user null to anonymous", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ user: null }), { status: 200 })) as unknown as typeof fetch;
    await expect(probeSession(fetchImpl)).resolves.toEqual({ status: "anonymous" });
  });

  it("returns only id/displayName for authenticated users", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({
      user: { id: "user-1", displayName: "순우", token: "must-ignore" },
    }), { status: 200 })) as unknown as typeof fetch;
    await expect(probeSession(fetchImpl)).resolves.toEqual({
      status: "authenticated",
      user: { id: "user-1", displayName: "순우" },
    });
  });

  it.each([
    new Response("no", { status: 500 }),
    new Response("not-json", { status: 200 }),
    new Response(JSON.stringify({ user: { id: "", displayName: "" } }), { status: 200 }),
  ])("normalizes invalid responses", async (response) => {
    const fetchImpl = vi.fn(async () => response) as unknown as typeof fetch;
    await expect(probeSession(fetchImpl)).rejects.toThrow("session_probe_failed");
  });
});
```

- [ ] **Step 2: Verify RED**

Run: `pnpm vitest run src/auth/client-session.test.ts`

Expected: FAIL because `src/auth/client-session.ts` does not exist.

- [ ] **Step 3: Implement the minimum probe**

```ts
export type PublicSessionUser = { id: string; displayName: string };
export type SessionProbeResult =
  | { status: "anonymous" }
  | { status: "authenticated"; user: PublicSessionUser };

export async function probeSession(fetchImpl: typeof fetch = fetch): Promise<SessionProbeResult> {
  try {
    const response = await fetchImpl("/auth/session", {
      method: "GET",
      cache: "no-store",
      credentials: "same-origin",
    });
    if (!response.ok) throw new Error("session_probe_failed");
    const payload = await response.json() as unknown;
    if (!payload || typeof payload !== "object" || !("user" in payload)) throw new Error("session_probe_failed");
    const user = payload.user;
    if (user === null) return { status: "anonymous" };
    if (!user || typeof user !== "object") throw new Error("session_probe_failed");
    const id = "id" in user ? user.id : null;
    const displayName = "displayName" in user ? user.displayName : null;
    if (typeof id !== "string" || !id || typeof displayName !== "string" || !displayName) {
      throw new Error("session_probe_failed");
    }
    return { status: "authenticated", user: { id, displayName } };
  } catch (error) {
    if (error instanceof Error && error.message === "session_probe_failed") throw error;
    throw new Error("session_probe_failed");
  }
}
```

- [ ] **Step 4: Run focused and full tests**

Run: `pnpm vitest run src/auth/client-session.test.ts && pnpm test:run`

Expected: PASS.

- [ ] **Step 5: Commit**

Commit: `feat: add public session probe client`.

---

### Task 2: Public auth-session provider and entry actions

**Files:**
- Create: `src/components/auth/auth-session-provider.tsx`
- Create: `src/components/auth/auth-entry-action.tsx`
- Test: `src/components/auth/auth-session-provider.test.tsx`
- Test: `src/components/auth/auth-entry-action.test.tsx`

**Interfaces:**
- Produces `AuthSessionProvider({ children, probe? })`.
- Produces hook `useAuthSession()` with:

```ts
type AuthSessionState =
  | { status: "checking"; retry(): void }
  | { status: "anonymous"; retry(): void }
  | { status: "authenticated"; user: PublicSessionUser; retry(): void }
  | { status: "error"; retry(): void };
```

- Produces `AuthEntryAction({ placement: "nav" | "hero" })`.

- [ ] **Step 1: Write failing provider tests**

Cover:

```text
initial checking text/state
checking -> anonymous
checking -> authenticated
probe rejection -> error
retry calls probe again and can recover
```

Use an injected `probe` promise factory rather than mocking global fetch.

- [ ] **Step 2: Write failing entry-action tests**

Assert:

```text
checking: disabled/non-navigation state with 로그인 상태 확인 중
anonymous nav: 꽃다발로 로그인 -> /auth/bouquet/start?returnTo=/dashboard
anonymous hero: 꽃다발로 시작하기 -> same URL
authenticated nav: 증빙함 열기 -> /dashboard
authenticated hero: 내 증빙함 열기 -> /dashboard
error: 다시 확인 control + direct 꽃다발 로그인 recovery link
```

- [ ] **Step 3: Verify RED**

Run: `pnpm vitest run src/components/auth/auth-session-provider.test.tsx src/components/auth/auth-entry-action.test.tsx`

Expected: FAIL because auth UI components do not exist.

- [ ] **Step 4: Implement provider**

Use one `useEffect`-driven probe per provider instance, a monotonically increasing retry counter, and an `active` boolean cleanup guard. Do not write session data to Web Storage.

- [ ] **Step 5: Implement entry actions**

Reuse existing landing CSS class names:

```text
nav placement -> nav-login
hero placement -> primary-button
```

The checking state is a button-like non-link element with `aria-busy="true"`; the error state exposes `다시 확인` and the direct Bouquet login link.

- [ ] **Step 6: Run focused/full tests and build**

Run: `pnpm vitest run src/components/auth/auth-session-provider.test.tsx src/components/auth/auth-entry-action.test.tsx && pnpm test:run && pnpm build`

Expected: PASS.

- [ ] **Step 7: Commit**

Commit: `feat: add session-aware auth entry actions`.

---

### Task 3: Landing auth error recovery and real Bouquet routes

**Files:**
- Create: `src/components/auth/auth-error-notice.tsx`
- Test: `src/components/auth/auth-error-notice.test.tsx`
- Modify: `app/page.tsx`

**Interfaces:**
- Produces `AuthErrorNotice({ code }: { code?: string | null })`.
- Recognized codes: `oauth_failed`, `session_required`.
- Unknown non-empty code uses generic OAuth-failure copy but never renders the raw code.

- [ ] **Step 1: Write failing error-notice tests**

Assert exact user-safe headings:

```text
oauth_failed -> 로그인을 완료하지 못했어요.
session_required -> 로그인이 필요해요.
unknown provider-secret-looking code -> generic heading and raw code absent
```

Also assert retry link equals `/auth/bouquet/start?returnTo=/dashboard` and landing reset link equals `/`.

- [ ] **Step 2: Verify RED**

Run: `pnpm vitest run src/components/auth/auth-error-notice.test.tsx`

Expected: FAIL because component does not exist.

- [ ] **Step 3: Implement notice using DS-001 `Notice`**

Use `danger` for OAuth failure and `info` for session-required. Keep copy neutral and concise.

- [ ] **Step 4: Modify landing page**

Make `LandingPage` accept Next.js search params, derive only `auth_error`, wrap session-aware actions with one `AuthSessionProvider`, and replace both legacy `/auth/login` links with `AuthEntryAction`.

Do not alter the existing hero, radar preview, principles, steps, disclaimer, or footer content except where needed for auth actions/error notice.

- [ ] **Step 5: Run tests/build**

Run: `pnpm vitest run src/components/auth/auth-error-notice.test.tsx && pnpm test:run && pnpm build`

Expected: PASS and no `/auth/login` reference in `app/page.tsx`.

- [ ] **Step 6: Commit**

Commit: `feat: connect landing to Bouquet auth flow`.

---

### Task 4: Server-gated protected route group and dashboard handoff

**Files:**
- Create: `src/auth/protected-session.ts`
- Test: `src/auth/protected-session.test.ts`
- Create: `app/(protected)/layout.tsx`
- Create: `app/(protected)/dashboard/page.tsx`
- Create: `src/components/auth/protected-shell.tsx`

**Interfaces:**
- Produces `resolveProtectedUser(rawToken, resolver?)` returning `{ id, displayName } | null`.
- Protected layout reads `ev_session`, calls `resolveProtectedUser`, redirects unauthenticated sessions to `/?auth_error=session_required`, and otherwise renders `ProtectedShell`.

- [ ] **Step 1: Write failing helper tests**

```ts
it("returns null without a token", async () => {
  const resolver = vi.fn();
  await expect(resolveProtectedUser(null, resolver)).resolves.toBeNull();
  expect(resolver).not.toHaveBeenCalled();
});

it("returns only safe local fields", async () => {
  const resolver = vi.fn(async () => ({ id: "user-1", displayName: "순우" }));
  await expect(resolveProtectedUser("raw-session", resolver)).resolves.toEqual({ id: "user-1", displayName: "순우" });
});
```

- [ ] **Step 2: Verify RED**

Run: `pnpm vitest run src/auth/protected-session.test.ts`

Expected: FAIL because helper does not exist.

- [ ] **Step 3: Implement helper and protected layout**

`resolveProtectedUser` delegates to existing `resolveProjectSession`. The layout uses `await cookies()` and `redirect()` from Next.js server APIs. No raw session value is passed to rendered components.

- [ ] **Step 4: Implement protected shell**

Render a compact document-first top navigation with:

```text
brand: 증빙함
navigation labels: 증빙함 / 분쟁 준비 / 가이드 / 계정
local display name
SignOutButton placeholder slot (wired in Task 5)
```

Until future routes exist, non-dashboard labels may render non-navigation text rather than broken links.

- [ ] **Step 5: Implement honest dashboard handoff**

The dashboard page contains no fake counts/data. Use copy equivalent to:

```text
증빙함에 로그인했어요.
꽃다발 계정으로 인증된 Evidence Vault 세션이 활성화되어 있습니다.
실제 증빙함 목록과 다가오는 기록 날짜는 FE-001에서 이 화면에 연결됩니다.
```

- [ ] **Step 6: Run focused/full tests and build**

Run: `pnpm vitest run src/auth/protected-session.test.ts && pnpm test:run && pnpm build`

Expected: PASS and build lists `/dashboard`.

- [ ] **Step 7: Commit**

Commit: `feat: add protected auth route boundary`.

---

### Task 5: Project sign-out UX

**Files:**
- Create: `src/components/auth/sign-out-button.tsx`
- Test: `src/components/auth/sign-out-button.test.tsx`
- Modify: `src/components/auth/protected-shell.tsx`

**Interfaces:**
- Produces `SignOutButton({ fetchImpl?, navigate? })`.
- Defaults: `fetchImpl = fetch`; `navigate = (path) => window.location.assign(path)`.

- [ ] **Step 1: Write failing sign-out tests**

Cover:

```text
POSTs /auth/sign-out
busy disables button and exposes aria-busy
success navigates to /
non-2xx shows 로그아웃을 완료하지 못했어요. and allows retry
raw response body is never rendered
```

- [ ] **Step 2: Verify RED**

Run: `pnpm vitest run src/components/auth/sign-out-button.test.tsx`

Expected: FAIL because component does not exist.

- [ ] **Step 3: Implement sign-out button**

Use DS-001 `Button`; render a compact `Notice` on failure. Do not clear Web Storage because no auth state is stored there.

- [ ] **Step 4: Wire protected shell**

Place sign-out beside the local display-name/session identity summary. Copy explicitly refers to Evidence Vault logout only; do not say central Bouquet logout.

- [ ] **Step 5: Run focused/full tests and build**

Run: `pnpm vitest run src/components/auth/sign-out-button.test.tsx && pnpm test:run && pnpm build`

Expected: PASS.

- [ ] **Step 6: Commit**

Commit: `feat: add project sign out UI`.

---

### Task 6: Styling, verification, and PR gate

**Files:**
- Modify: `app/globals.css`
- Modify: `docs/VERIFICATION.md`

**Interfaces:**
- Produces final AUTHUI-001 automated evidence and responsive auth styles.

- [ ] **Step 1: Add only auth-composition styles needed by new surfaces**

Add classes for:

```text
auth notice spacing on landing
checking/error action grouping
protected shell header/navigation
protected dashboard handoff reading-width panel
sign-out error placement
320px stacking/wrapping
```

Reuse semantic DS-001 variables; do not introduce a new palette.

- [ ] **Step 2: Run full unit suite**

Run: `pnpm test:run`

Expected: all test files/tests PASS.

- [ ] **Step 3: Run production build**

Run: `pnpm build`

Expected: exit 0 with `/dashboard` and all auth routes present.

- [ ] **Step 4: Diff security scan**

Verify the AUTHUI diff contains none of:

```text
/auth/login
<input type="password">
localStorage
sessionStorage
raw provider error rendering
ev_session value exposed to client props
external returnTo construction
```

Legitimate mentions in tests/specs explaining forbidden patterns are allowed; production code is the blocker.

- [ ] **Step 5: Update verification evidence**

Record RED/GREEN workflow runs, exact final unit count/build result, and explicitly leave real Bouquet browser E2E + 320px/keyboard/focus as QA deployment gates.

- [ ] **Step 6: Commit**

Commit: `docs: verify auth UI flow`.

- [ ] **Step 7: Open PR to `develop` using repository-required format**

Title:

```text
feat : 꽃다발 인증 UI 연결
```

Body order must remain:

```text
# ✨ PR 내용
## 📝 코드 변경 사항
## 💡 변경 이유
## 🛠️ 구현 방법
## 📌 영향 범위
## ✅ 테스트
**테스트 결과 / 참고 사항**
## 🌿 반영 브랜치
- develop
```

## Self-Review

- Spec coverage: public checking/anonymous/authenticated/error, callback recovery, server protected boundary, `/dashboard` handoff, sign-out, privacy/security, accessibility, and test/build gates are mapped to Tasks 1–6.
- Placeholder scan: no TBD/TODO implementation placeholders are present.
- Type consistency: `PublicSessionUser`, `SessionProbeResult`, provider state, protected-user helper, and sign-out injected dependencies are defined before use.
- Scope: no onboarding persistence, dashboard data, VaultItem CRUD, or central account management is included.

## Execution Handoff

Execution mode: **Inline Execution** in this ChatGPT session. Each task still requires its own RED/GREEN GitHub Actions checkpoint before proceeding to the next production boundary.
