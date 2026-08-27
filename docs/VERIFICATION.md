# Verification status

## Baseline migration

The Evidence Vault application baseline was migrated from the fixed legacy snapshot recorded in `docs/MIGRATION_NOTES.md` into `BloomBouquet/evidence-vault`.

Verified migration state:

- canonical application source is the dedicated repository,
- `pnpm-lock.yaml` is committed,
- `.foundation-complete`, `.env`, `.data/`, `node_modules/`, and `.next/` were not migrated,
- final frozen-lockfile migration verification run `33087814331` completed successfully with dependency install, unit tests, and production build.

## Design system DS-001

### TDD RED evidence

Each new design-system behavior was introduced with a failing test before implementation.

| Contract | GitHub Actions run | Observed RED reason |
|---|---:|---|
| semantic tokens / primitive styles | `33089594234` | only the new style-contract assertions failed because `tokens.css` and `primitives.css` did not exist |
| Button | `33089884639` | new Button suite failed because `./button` did not exist |
| accessible fields | `33090235573` | new field suite failed because `./select-field` did not exist |
| Notice / StatusBadge / DeadlineIndicator | `33090468984` | new status suite failed because `./deadline-indicator` did not exist |
| EmptyState / LoadingState | `33090658267` | new state suite failed because `./empty-state` did not exist |
| Notice contrast + EmptyState raw-link target | `33091315257` | only the two new accessibility assertions failed: notice body did not inherit contrast-safe variant foreground and raw EmptyState links lacked the minimum target height |

During the Button GREEN cycle, run `33089964531` exposed test-environment state leaking between component tests. The production Button contract was not the failure source. `src/test/setup.ts` was updated to call Testing Library `cleanup()` after each test, and run `33090149308` then passed unit tests and the production build.

### Token contrast verification

WCAG contrast ratios were calculated from the committed semantic token hex values using the standard sRGB relative-luminance formula. Representative primitive text/background pairs are all at or above the 4.5:1 AA threshold for normal text:

| Pair | Ratio |
|---|---:|
| primary text / canvas | `14.87:1` |
| secondary text / canvas | `4.92:1` |
| secondary text / surface | `5.33:1` |
| brand / canvas | `9.07:1` |
| info / info-soft | `6.54:1` |
| success / success-soft | `8.64:1` |
| warning / warning-soft | `5.63:1` |
| danger / danger-soft | `5.29:1` |
| white / danger button | `7.47:1` |
| brand / privacy-subtle | `8.64:1` |

The accessibility regression in `33091315257` resulted in notice bodies inheriting each contrast-safe variant foreground rather than the generic secondary color.

### Final automated verification

Final DS-001 implemented-state verification run: `33091435986`.

Observed results:

```text
pnpm install --frozen-lockfile  PASS
pnpm test:run                  PASS — 11 test files, 32 tests
pnpm build                     PASS — Next.js 16.3.3 production build and TypeScript check
```

The build produced the expected application routes for the current baseline: `/`, `/_not-found`, and `/api/health`.

### Not yet claimed as PASS

The following checks require a real browser/manual accessibility pass and were not performed as part of DS-001 automated CI:

- 320px viewport visual/layout inspection of composed screens,
- 200% browser zoom operability of composed screens,
- complete keyboard-only traversal across composed product workflows,
- measured contrast verification after tokens are combined with every future screen-specific surface/composition,
- screen-reader behavior across full auth/dashboard/evidence flows.

These remain explicit Designer/QA follow-up gates. The primitive layer includes focus, target-size, semantic-label, reduced-motion, wrapping, and contrast-safe token hooks, but this document does not claim the later browser-level workflow checks are already complete.

## Bouquet auth server AUTH-001

AUTH-001 implements the Evidence Vault server-side portion of shared 꽃다발 SSO. It uses Authorization Code + PKCE S256 and converts verified central `userinfo` into an Evidence Vault-owned hashed opaque session. Evidence Vault does not add a project-owned email/password credential store.

### TDD RED evidence

Each auth subsystem was introduced with a failing test before its production module/route was implemented.

| Contract | GitHub Actions run | Observed RED reason |
|---|---:|---|
| auth environment/config parser | `33125078403` | existing tests passed; the new config suite failed because `src/auth/config.ts` did not exist |
| server-only Bouquet provider client | `33125215396` | existing tests passed; the new provider-client suite failed because the module did not exist |
| minimal local identity repository | `33125329072` | existing tests passed; the new identity-repository suite failed because the module did not exist |
| opaque application session service | `33125450896` | 49 existing tests passed; the new project-session suite failed because the module did not exist |
| login-start route | `33125636109` | 54 existing tests passed; the new route suite failed because `/auth/bouquet/start` did not exist |
| OAuth callback route | `33125773736` | 58 existing tests passed; the new callback suite failed because `/auth/bouquet/callback` did not exist |
| session probe + project sign-out | `33125926505` | 67 existing tests passed; only the two new route suites failed because the routes did not exist |
| callback/session response privacy headers | `33126148395` | 60 tests passed and 11 new assertions failed because callback/session responses lacked explicit no-store/no-referrer privacy headers |

### Implemented security contract

- `APP_BASE_URL`, `BOUQUET_BASE_URL`, `BOUQUET_CLIENT_ID`, `BOUQUET_REDIRECT_URI`, and `SESSION_SECRET` are validated server-side.
- Production app, Bouquet provider, and callback URLs must use HTTPS.
- Login attempts keep PKCE verifier/state/returnTo in an AES-256-GCM sealed, short-lived HttpOnly cookie; verifier is not placed in the redirect URL.
- Callback validates the sealed attempt and state before server-side code exchange and `/userinfo`.
- Provider token/userinfo failures are normalized without rendering provider response bodies or access tokens.
- Only central subject and display name are used for the local Evidence Vault identity; provider email is not persisted by AUTH-001.
- Soft-deleted Evidence Vault accounts are not silently reactivated by a new SSO login.
- Application session tokens are 32 random bytes encoded base64url; only SHA-256 hashes are passed to the session repository/database.
- `/auth/session` returns only local `id/displayName` or `user: null` and sets `Cache-Control: no-store`.
- Callback success and failure responses set `Cache-Control: no-store` and `Referrer-Policy: no-referrer` so the callback URL carrying OAuth code/state is not intentionally cached or forwarded as referrer information.
- `/auth/sign-out` revokes the Evidence Vault session when present, clears its cookie, and does not remove the central Bouquet SSO session.
- External, protocol-relative, and backslash `returnTo` targets are rejected in favor of `/dashboard`.

### Final automated verification

Final AUTH-001 code-state verification run: `33126278932` at branch HEAD `e1021def9cb751b13c39f8a4a070f3f77f1de64b`.

Observed results:

```text
pnpm install --frozen-lockfile  PASS
pnpm test:run                  PASS — 19 test files, 71 tests
pnpm build                     PASS — Next.js 16.3.3 production build and TypeScript check
```

The build produced these current auth routes:

```text
/auth/bouquet/start
/auth/bouquet/callback
/auth/session
/auth/sign-out
```

### Not yet claimed as PASS

AUTH-001 automated verification does **not** claim a real deployed end-to-end Bouquet login. That requires a registered Evidence Vault Bouquet client, actual deployment URLs/configuration, PostgreSQL runtime, and the central Bouquet provider to be available together. The later Frontend AUTHUI/QA flow must verify anonymous → central 꽃다발 portal → callback → protected application → project sign-out/session-expiry behavior in a real browser/deployed-equivalent environment.

## Current verification rule

A later Agent must re-run the relevant unit/build/browser checks after composing these primitives and auth routes into onboarding, dashboard, timeline, upload, case/export, or privacy flows. Existing DS-001/AUTH-001 CI evidence is not a substitute for testing those future flows.
