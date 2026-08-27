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

## Current verification rule

A later Agent must re-run the relevant unit/build/browser checks after composing these primitives into auth, dashboard, timeline, upload, case/export, or privacy flows. Existing DS-001 CI evidence is not a substitute for testing those future flows.
