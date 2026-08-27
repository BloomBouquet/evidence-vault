# Evidence Vault — Luna v3 Task DAG

Updated: 2026-08-27
Team: 해바라기
Canonical repository: `BloomBouquet/evidence-vault`
Integration branch: `develop`
Release branch: `main`

## Agent roster

Team 해바라기 owns 15 independent delivery Agent states:

1. Idea Agent
2. PM Agent
3. Design System Agent
4. Designer Agent
5. Frontend Agent
6. Backend Agent
7. Data & Marketing Agent
8. Code Review Agent
9. Reviewer Agent
10. QA Agent
11. Documentation Agent
12. Debug / Problem Router Agent
13. User Agent A — first-time user
14. User Agent B — experienced user
15. Process Evaluator Agent

Organization Project Intake and Team Evolution are organization-level roles and are not counted as delivery-team Agents.

## Execution rules

- Writer branch: `agent/해바라기/<role>/<task>`.
- Writer PR base: `develop`.
- Maximum two dependency-ready tasks per wave.
- Maximum one running task for the same role.
- Review/User/Process Evaluator tasks are independent sessions and do not inherit another Agent's judgment as truth.
- Debug / Problem Router is conditional and is dispatched only for blocked execution.
- A writer task is complete only when branch, commit, PR, and reported verification evidence agree with actual repository state.

## Shared 꽃다발 auth injection

Evidence Vault is `needsAuth=true`, so the upgraded Luna auth policy requires two independent standard tasks:

- Backend `bouquet-auth-server` task.
- Frontend `bouquet-auth-client` task.

The Frontend auth task directly depends on the Backend auth contract. Neither task may be folded into an unrelated dashboard or domain task.

## DAG

| ID | Role | Task | Branch | Depends on |
|---|---|---|---|---|
| PM-001 | PM | Luna v3 repository replan | `agent/해바라기/pm/luna-v3-replan` | repository intake complete |
| IDEA-001 | Idea | Product continuity / premise review | `agent/해바라기/idea/product-continuity-review` | PM-001 |
| BE-001 | Backend | Migrate verified Playground baseline + CI | `agent/해바라기/backend/migrate-baseline` | PM-001 |
| DS-001 | Design System | Product design tokens/primitives | `agent/해바라기/design-system/foundation` | BE-001 |
| DES-001 | Designer | Core user-flow specification | `agent/해바라기/designer/core-flows` | IDEA-001, DS-001 |
| AUTH-001 | Backend | 꽃다발 SSO server client: OAuth state/PKCE/callback/token/userinfo/app session | `agent/해바라기/backend/bouquet-auth-server` | BE-001 |
| AUTHUI-001 | Frontend | 꽃다발 SSO client states/login/callback/logout/401 resync | `agent/해바라기/frontend/bouquet-auth-client` | AUTH-001, DES-001 |
| BE-003 | Backend | Vault/Deadline/Event owner-scoped API | `agent/해바라기/backend/vault-domain-api` | BE-001 |
| BE-004 | Backend | Private evidence storage + integrity + deletion primitives | `agent/해바라기/backend/private-evidence-storage` | BE-001 |
| FE-001 | Frontend | Dashboard + Vault CRUD UI | `agent/해바라기/frontend/dashboard-vault-flow` | DES-001, AUTHUI-001, BE-003 |
| FE-002 | Frontend | Timeline/upload/download/privacy UX | `agent/해바라기/frontend/evidence-timeline` | FE-001, BE-004 |
| BE-005 | Backend | Case mode + export packet + deletion reconciliation | `agent/해바라기/backend/case-export-deletion` | BE-003, BE-004 |
| FE-003 | Frontend | Case/export/privacy settings + complete app states | `agent/해바라기/frontend/case-export-privacy` | FE-002, BE-005 |
| DM-001 | Data & Marketing | Product/market/measurement analysis | `agent/해바라기/data-marketing/market-measurement` | FE-003, BE-005 |
| DOC-001 | Documentation | Release docs + independently verified GTM | `agent/해바라기/documentation/release-docs` | DM-001 |
| CR-001 | Code Review | Independent code review gate | read-only review session | DOC-001 + required product PRs |
| REV-001 | Reviewer | Independent requirement/review adjudication | read-only review session | CR-001 |
| QA-001 | QA | Build/E2E/security/accessibility/browser gate | read-only QA session | REV-001 |
| UA-001 | User A | First-time user validation | read-only user session | QA-001 |
| UB-001 | User B | Experienced/repeat-use validation | read-only user session | QA-001 |
| PE-001 | Process Evaluator | Aggregate independent evidence and release recommendation | read-only evaluator session | UA-001, UB-001 |

## Dependency graph

```text
PM-001
├─ IDEA-001 ───────────────┐
└─ BE-001                  │
   ├─ DS-001 ── DES-001 ───┤
   ├─ AUTH-001 ─ AUTHUI-001 ┤
   ├─ BE-003 ───────────────┤
   └─ BE-004 ───────────────┘
                           ↓
                         FE-001
                           ↓ + BE-004
                         FE-002

BE-003 + BE-004 → BE-005
FE-002 + BE-005 → FE-003
FE-003 + BE-005 → DM-001
DM-001 → DOC-001 → CR-001 → REV-001 → QA-001
QA-001 → UA-001
QA-001 → UB-001
UA-001 + UB-001 → PE-001 → integration/release decision
```

## Authentication acceptance contract

### AUTH-001 Backend

The Backend auth task must verify all of the following before completion:

- no project-owned 꽃다발 signup/password store,
- server-generated OAuth state and RFC 7636 PKCE S256 verifier/challenge,
- verifier stored only in protected short-lived server state/cookie until callback,
- exact registered redirect URI,
- constant-time or equivalent safe state validation,
- server-side one-time authorization-code exchange,
- server-side `/userinfo` request,
- no bouquet token/code/verifier in browser localStorage/sessionStorage/client bundle/logs,
- application-owned HttpOnly/Secure production session after verified userinfo,
- safe internal-only `returnTo`,
- logout invalidates the Evidence Vault session without deleting the central bouquet SSO session,
- stable 401/403/auth error contract without account/token leakage,
- automated tests for login start, callback success, state mismatch, invalid PKCE, code reuse/failure, anonymous session, logout, and expired session.

### AUTHUI-001 Frontend

The Frontend auth task must verify:

- distinct `checking`, `anonymous`, `redirecting`, `callback`, `authenticated`, and `error` UI states,
- no protected-content auth flash during initial session check,
- login goes through the project Backend/BFF into the central 꽃다발 portal; no email/password fields in Evidence Vault,
- callback refresh/duplicate handling is safe,
- session is rechecked after callback before protected UI appears,
- anonymous/401 states expose a clear reauthentication path without redirect loops,
- errors expose retry without showing code/token/verifier/provider internals,
- auth actions are keyboard/focus accessible,
- browser-level flow covers anonymous → 꽃다발 Portal → callback → protected app → project logout/session expiry.

## Task-specific plan rule

This file is the orchestration DAG, not a substitute for implementation detail. Before a production-code task starts, the owning Agent must create or consume a task-specific implementation plan that names exact files/interfaces/tests and follows RED → GREEN TDD. PM may replan dependencies when evidence proves the DAG wrong, but it must preserve completed repository evidence and record the reason.

## Mandatory Data & Marketing / Documentation chain

`DM-001` owns:

`docs/marketing/MARKETING_ANALYSIS.md`

It must distinguish:
- observed product facts,
- actually measured first-party data,
- sourced external evidence,
- inference,
- experiment hypotheses.

It must not fabricate market size, users, CTR, conversion, CAC, LTV, retention, growth, or competitor performance.

`DOC-001` independently verifies the release repository and DM-001 evidence, then owns:

`docs/marketing/GO_TO_MARKET.md`

The Documentation Agent removes unsupported claims rather than copying the Data & Marketing report blindly.

## Debug / Problem Router

When any task becomes blocked, create a conditional Debug Router run that records:

- affected task/Agent,
- failure type and severity,
- reproducible evidence,
- current branch/commit/PR where applicable,
- recovery route,
- rationale.

Allowed recovery routes:

1. bounded retry of the owning task,
2. PM replanning,
3. Product Owner decision.

A task never becomes `done` merely because a retry budget was exhausted.

## Product-specific hard gates

The following findings are objective blockers, regardless of Agent preference:

- cross-user access to another user's VaultItem, event, file, case, or export,
- permanent/public evidence object URLs,
- signed URL issuance without server-side ownership verification,
- project-owned email/password credential storage,
- bouquet token/code/verifier exposure to browser persistent storage or logs,
- legal-entitlement/individualized legal-advice claims outside the approved product boundary,
- missing deletion of stored evidence after the documented deletion workflow completes,
- intentional medical/health dispute workflow in MVP,
- failing required build/test/QA evidence,
- fabricated analytics/market/deployment results.

## Release integration

`main` is not used for normal Agent development. Required writer PRs first integrate into `develop`. Release promotion occurs only after the review → QA → User A/B → Process Evaluator evidence is complete and unresolved objective blockers are cleared.
