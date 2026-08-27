# Evidence Vault Luna v3 Replan Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the existing Evidence Vault progress from the legacy Playground subtree into `BloomBouquet/evidence-vault`, then finish the MVP through the upgraded 15-Agent Team 해바라기 workflow with `develop` integration and evidence-gated release review.

**Architecture:** Evidence Vault remains a standalone Next.js 16 application with server-owned sessions, PostgreSQL/Drizzle persistence, private S3-compatible evidence storage, and BloomBouquet 꽃다발 OAuth Authorization Code + PKCE S256. The dedicated repository root contains the application directly; `main` is release-only, `develop` is integration, and writer Agents work through `agent/해바라기/<role>/<task>` branches and PRs targeting `develop`.

**Tech Stack:** Next.js 16, React 19, TypeScript, Zod, PostgreSQL, Drizzle ORM, S3-compatible private object storage, Vitest, Testing Library, Playwright, Docker-compatible standalone build.

**Spec:** Product constraints are carried from the legacy Evidence Vault design and `PRODUCT.md`; this replan supersedes the former role-branch execution structure. Legacy code source snapshot: `sunwoo162/Playground` branch `evidence-vault/backend`, commit `101198ba3e367f7d8e21027cacd263e9ad866264`.

## Global Constraints

- Canonical repository is `BloomBouquet/evidence-vault`.
- `main` is the release branch; Agent PRs target `develop`.
- Writer branch naming is `agent/해바라기/<role>/<task>`.
- Team 해바라기 owns 15 independent Agent states: Idea, PM, Design System, Designer, Frontend, Backend, Data & Marketing, Code Review, Reviewer, QA, Documentation, Debug / Problem Router, User A, User B, Process Evaluator.
- Project Intake and Team Evolution are organization-level roles outside the 15 delivery Agents.
- At most two dependency-ready tasks may execute in one wave and no two running tasks may use the same role.
- Agents never fabricate build/test/deploy results, credentials, analytics, user metrics, market figures, or external-service state.
- Evidence Vault does not provide individualized legal advice, legal representation, legal conclusions, or win/refund probability predictions.
- Deadlines remain source-labelled/user-recorded dates and are never silently converted into legal entitlement claims.
- SHA-256 is described only as an integrity fingerprint.
- Evidence is private by default; permanent public object URLs are prohibited.
- MVP intentionally excludes medical/health dispute evidence as a normal workflow.
- The project does not create an email/password credential store; it uses shared 꽃다발 Authorization Code + PKCE S256.
- Bouquet access tokens, authorization codes, PKCE verifiers, signed URLs, evidence contents, and secret values must not enter browser persistent storage, analytics, repository, or application logs.
- All protected resource access is server-side owner-scoped.
- Production implementation changes follow RED → verify RED → minimal GREEN → verify GREEN → refactor.
- Generic AI-looking UI is not a design strategy: no unsupported glow/glassmorphism, automatic purple/blue gradients, emoji-heavy decoration, fake KPI dashboards, or excessive rounded-card layouts.
- Release governance after verified product work is `Data & Marketing → Documentation → Code Review → Reviewer → QA`, followed in this project by independent User A/User B validation and Process Evaluator aggregation.

---

## Current State Mapping

The previous run created useful code in the wrong repository/runtime shape. It is treated as source evidence, not as an integrated release.

Observed legacy progress at `101198ba3e367f7d8e21027cacd263e9ad866264`:

- Next.js foundation, landing shell, legal disclaimer, `/api/health`.
- product/environment documentation and private local-data `.gitignore` rules.
- domain types for VaultItem, Deadline, Evidence, Case, Export.
- deadline wording helpers that avoid silently asserting legal entitlement.
- PostgreSQL/Drizzle schema and owner-scoped repository functions.
- PKCE/state primitives and encrypted short-lived OAuth login-attempt state.
- unit tests for health/domain/ownership/auth primitives.

Not yet trusted as complete:

- no full dependency install/build/test result was produced in the prior sandbox because external package resolution was unavailable.
- OAuth callback/token exchange/userinfo/application session is incomplete.
- Vault CRUD/dashboard, private uploads, signed downloads, case mode, export packet, deletion reconciliation, PWA, E2E, production CI/deployment, marketing/documentation/review gates are incomplete.
- old `evidence-vault/<role>` branches are retired and must not be merged into this repository.

---

## Task DAG

```text
PM-001 Luna v3 replan (this PR)
  |
  +--> IDEA-001 Product continuity review
  |
  +--> BE-001 Dedicated-repo baseline migration + CI baseline
          |
          +--> DS-001 Design system foundation
          |      |
          |      +--> DES-001 Core UX flows
          |
          +--> BE-002 Bouquet OAuth callback + application session
          |
          +--> BE-003 Vault CRUD + deadline/event persistence APIs
          |
          +--> BE-004 Private evidence storage + integrity + deletion primitives

DES-001 + BE-002 + BE-003
  +--> FE-001 Auth shell + dashboard + vault CRUD UI

FE-001 + BE-004
  +--> FE-002 Evidence timeline/upload/download/redaction UX

BE-003 + BE-004
  +--> BE-005 Case mode + neutral checklist + export packet + deletion reconciliation

FE-002 + BE-005
  +--> FE-003 Case/export/privacy settings + complete error/empty/loading/permission states

FE-003 + BE-005
  +--> DM-001 Data & Marketing analysis/measurement plan
          |
          +--> DOC-001 Release documentation + GTM verification
                  |
                  +--> CR-001 Independent code review
                          |
                          +--> REV-001 Independent reviewer gate
                                  |
                                  +--> QA-001 Browser/E2E/security/accessibility QA
                                          |
                                          +--> UA-001 First-time user validation
                                          +--> UB-001 Experienced user validation
                                                  |
                                          UA-001 + UB-001
                                                  |
                                                  +--> PE-001 Process evaluation / release recommendation
```

`DEBUG-*` tasks are created only when a planned task becomes blocked. The Debug / Problem Router chooses bounded retry, PM replanning, or Product Owner decision based on evidence.

---

### Task PM-001: Apply Luna v3 repository and execution contract

**Role:** PM Agent

**Branch:** `agent/해바라기/pm/luna-v3-replan`

**Files:**
- Create: `AGENTS.md`
- Create: `docs/superpowers/plans/2026-08-27-evidence-vault-luna-v3-replan.md`

**Produces:** canonical repository rules, upgraded Agent roster, Task DAG, legacy-progress mapping.

- [x] **Step 1: Confirm canonical repository exists**

Expected repository: `BloomBouquet/evidence-vault`.

- [x] **Step 2: Initialize `main` if the repository is empty**

Commit message: `chore: initialize evidence vault repository`.

- [x] **Step 3: Create integration branch**

Branch: `develop` from `main`.

- [x] **Step 4: Create PM branch using the upgraded convention**

Branch: `agent/해바라기/pm/luna-v3-replan` from `develop`.

- [x] **Step 5: Persist repository Agent rules and this replan**

Commits are English and the PR targets `develop`.

---

### Task IDEA-001: Revalidate product premise without resetting approved scope

**Role:** Idea Agent

**Branch:** `agent/해바라기/idea/product-continuity-review`

**Depends on:** PM-001

**Files:**
- Create: `docs/product/IDEA_REVIEW.md`

**Consumes:** approved Evidence Vault concept, current Korean consumer-dispute/evidence research, legal guardrails.

**Produces:** a concise product-continuity decision: keep/pivot/stop, supported by evidence; no fabricated market metrics.

- [ ] **Step 1: Re-check the job-to-be-done and differentiation against current evidence**

The analysis must distinguish observed/sourced facts from inference.

- [ ] **Step 2: Check that the service remains an evidence/deadline organization tool rather than legal-advice automation**

Any proposed feature that crosses the legal-service boundary is rejected or routed to Product Owner/legal review.

- [ ] **Step 3: Record a scope decision**

Expected default when evidence remains consistent: retain `증빙함 / evidence-vault` and existing MVP boundaries.

- [ ] **Step 4: Commit and open a PR to `develop`**

Commit: `docs: validate evidence vault product premise`.

---

### Task BE-001: Migrate the legacy baseline into the dedicated repository and establish CI

**Role:** Backend Agent

**Branch:** `agent/해바라기/backend/migrate-baseline`

**Depends on:** PM-001

**Files:**
- Create at repository root from the legacy `evidence-vault/` subtree: `.env.example`, `.gitignore`, `PRODUCT.md`, `package.json`, `app/**`, `src/**`, `drizzle.config.ts`, `next-env.d.ts`, `next.config.ts`, `postcss.config.mjs`, `tsconfig.json`, `vitest.config.ts`.
- Do NOT copy: `.foundation-complete`.
- Create: `.github/workflows/ci.yml`.
- Update: `README.md`.

**Consumes:** exact source snapshot `sunwoo162/Playground@101198ba3e367f7d8e21027cacd263e9ad866264`, restricted to the `evidence-vault/` subtree.

**Produces:** flattened standalone application at the new repository root plus reproducible CI.

- [ ] **Step 1: Copy only the Evidence Vault subtree into the new repository root**

No Playground/Bloom runtime files are imported.

- [ ] **Step 2: Remove obsolete execution markers and stale README claims**

`.foundation-complete` is not migrated. README must state the current implemented/incomplete scope accurately.

- [ ] **Step 3: Install dependencies with pnpm and generate the lockfile in an environment with package-registry access**

Run: `pnpm install`.

Expected: a committed `pnpm-lock.yaml`; if registry/network is unavailable, mark the task blocked instead of claiming success.

- [ ] **Step 4: Run the migrated unit suite before adding new behavior**

Run: `pnpm test:run`.

Expected: all migrated tests pass. Any failure is investigated as migration drift before feature work.

- [ ] **Step 5: Run type/build verification**

Run: `pnpm build`.

Expected: production build succeeds. Missing required production env values may be represented by explicit test/dev-safe parsing where the app contract permits; secrets are never invented.

- [ ] **Step 6: Add CI**

`ci.yml` runs clean install, unit tests, and build on PRs targeting `develop` and `main`.

- [ ] **Step 7: Commit and PR**

Commit: `chore: migrate evidence vault baseline`.

PR base: `develop`.

---

### Task DS-001: Establish product-specific design system

**Role:** Design System Agent

**Branch:** `agent/해바라기/design-system/foundation`

**Depends on:** BE-001

**Files:**
- Create: `docs/design/DESIGN_SYSTEM.md`
- Create/Modify: product tokens and shared UI primitives under `src/components/ui/**` or the final existing convention selected after repository inspection.

**Produces:** typography, spacing, hierarchy, focus, status, form, deadline urgency, evidence/privacy states, and component contracts grounded in the product workflow.

- [ ] **Step 1: Audit the migrated landing styles instead of blindly preserving them**
- [ ] **Step 2: Define semantic tokens for text, surfaces, borders, success/warning/error, focus, deadline urgency, and privacy-sensitive states**
- [ ] **Step 3: Define accessible Button/Input/Field/Notice/Status primitives with keyboard/focus requirements**
- [ ] **Step 4: Verify contrast and 320px mobile constraints**
- [ ] **Step 5: Commit and PR to `develop`**

Commit: `feat: add evidence vault design system`.

---

### Task DES-001: Design the primary consumer evidence workflows

**Role:** Designer Agent

**Branch:** `agent/해바라기/designer/core-flows`

**Depends on:** IDEA-001, DS-001

**Files:**
- Create: `docs/design/CORE_FLOWS.md`

**Produces:** explicit states and interaction contracts for landing/login, dashboard, create vault, deadline entry, timeline/evidence upload, case mode, export, account/privacy deletion.

- [ ] **Step 1: Map first-time flow from landing to first saved VaultItem**
- [ ] **Step 2: Map deadline-first dashboard hierarchy**
- [ ] **Step 3: Map privacy warning/redaction/upload failure behavior**
- [ ] **Step 4: Map case/export review with neutral legal wording**
- [ ] **Step 5: Include loading/empty/invalid/error/permission/retry states and keyboard/mobile behavior**
- [ ] **Step 6: Commit and PR to `develop`**

Commit: `docs: define evidence vault core flows`.

---

### Task BE-002: Complete 꽃다발 OAuth callback and app session

**Role:** Backend Agent

**Branch:** `agent/해바라기/backend/bouquet-auth-server`

**Depends on:** BE-001

**Key files:**
- Existing: `src/auth/pkce.ts`, `src/auth/login-attempt.ts`, auth tests.
- Create: callback/token/userinfo/session route/service files according to inspected Next.js structure.

**Produces:** server-only OAuth state/PKCE lifecycle, code exchange, userinfo, Evidence Vault profile link, secure application session, logout and stable 401/403 contract.

- [ ] **Step 1: Write failing tests for valid callback, state mismatch, expired/reused attempt, token failure, userinfo failure, session creation, logout, and invalid return path**
- [ ] **Step 2: Run the focused tests and verify each fails for the missing behavior**
- [ ] **Step 3: Implement minimum callback/token/userinfo/session behavior**
- [ ] **Step 4: Verify access token/code/verifier never appears in client persistence or logs**
- [ ] **Step 5: Run auth tests and the full unit suite**
- [ ] **Step 6: Commit and PR to `develop`**

Commit: `feat: complete bouquet oauth session flow`.

---

### Task BE-003: Implement Vault CRUD and factual timeline persistence

**Role:** Backend Agent

**Branch:** `agent/해바라기/backend/vault-domain-api`

**Depends on:** BE-001

**Produces:** authenticated owner-scoped APIs for VaultItem, Deadline, EvidenceEvent, dashboard queries.

- [ ] **Step 1: Write failing repository/service tests proving cross-user access returns no resource**
- [ ] **Step 2: Write failing validation tests for categories, date source labels, titles, amounts, event types, and unsafe input**
- [ ] **Step 3: Implement minimal owner-scoped create/read/update/archive/delete operations**
- [ ] **Step 4: Implement deadline/dashboard ordering without inferring legal entitlement**
- [ ] **Step 5: Run unit/integration tests and build**
- [ ] **Step 6: Commit and PR to `develop`**

Commit: `feat: add vault and timeline api`.

---

### Task BE-004: Implement private evidence storage and deletion primitives

**Role:** Backend Agent

**Branch:** `agent/해바라기/backend/private-evidence-storage`

**Depends on:** BE-001

**Produces:** authenticated upload intent, allowlisted file validation, SHA-256 integrity fingerprint, private object keys, five-minute signed downloads, object deletion jobs.

- [ ] **Step 1: Write failing tests for disallowed MIME/extension/size, foreign owner, public URL leakage, signed URL TTL, and deletion reconciliation**
- [ ] **Step 2: Verify RED**
- [ ] **Step 3: Implement PDF/JPEG/PNG/WEBP allowlist and 20 MiB per-file limit**
- [ ] **Step 4: Implement private storage key generation and server-side owner checks before every signed URL**
- [ ] **Step 5: Generate five-minute signed download URLs only after authorization**
- [ ] **Step 6: Compute SHA-256 as an integrity fingerprint without legal-authenticity claims**
- [ ] **Step 7: Implement retryable object deletion state**
- [ ] **Step 8: Run focused security tests, full unit suite, and build**
- [ ] **Step 9: Commit and PR to `develop`**

Commit: `feat: add private evidence storage`.

---

### Task FE-001: Implement auth client, dashboard, and Vault CRUD UI

**Role:** Frontend Agent

**Branch:** `agent/해바라기/frontend/dashboard-vault-flow`

**Depends on:** DES-001, BE-002, BE-003

**Produces:** credential-free 꽃다발 login entry, callback/session states, protected dashboard, first VaultItem flow, deadlines and event text UI.

- [ ] **Step 1: Write failing component tests for checking/anonymous/redirecting/callback/authenticated/error auth states and auth-flash prevention**
- [ ] **Step 2: Implement login button that enters the server-owned 꽃다발 flow; never render project email/password fields**
- [ ] **Step 3: Implement dashboard empty/loading/error states and `첫 증빙함 만들기` flow**
- [ ] **Step 4: Implement deadline cards using source-labelled wording**
- [ ] **Step 5: Verify keyboard/focus/mobile behavior**
- [ ] **Step 6: Run unit tests and build**
- [ ] **Step 7: Commit and PR to `develop`**

Commit: `feat: add dashboard and vault flow`.

---

### Task FE-002: Implement evidence timeline and privacy-aware file UX

**Role:** Frontend Agent

**Branch:** `agent/해바라기/frontend/evidence-timeline`

**Depends on:** FE-001, BE-004

**Produces:** timeline event creation, upload/privacy warning, redaction/exclusion affordance, attachment states, authenticated download.

- [ ] **Step 1: Write failing UI tests for upload success/failure/retry, unsupported file, oversized file, permission failure, and redaction warning**
- [ ] **Step 2: Implement event-first attachment workflow**
- [ ] **Step 3: Never show an attachment as saved before server persistence succeeds**
- [ ] **Step 4: Provide explicit guidance to redact resident registration numbers and unnecessary third-party personal data**
- [ ] **Step 5: Run component tests/build and keyboard/mobile review**
- [ ] **Step 6: Commit and PR to `develop`**

Commit: `feat: add evidence timeline workflow`.

---

### Task BE-005: Implement case mode, neutral export, and account-data deletion

**Role:** Backend Agent

**Branch:** `agent/해바라기/backend/case-export-deletion`

**Depends on:** BE-003, BE-004

**Produces:** neutral case checklist, export packet generation, manifest hashes, authenticated export storage/download, full deletion reconciliation.

- [ ] **Step 1: Write failing tests proving checklist labels never imply uncited legal necessity**
- [ ] **Step 2: Write failing export tests for chronology, included evidence index, SHA-256 values, disclaimer, and forbidden legal-conclusion phrases**
- [ ] **Step 3: Implement ZIP containing `summary.pdf`, `manifest.json`, and selected `evidence/*`**
- [ ] **Step 4: Keep export private and issue signed access only after owner authorization**
- [ ] **Step 5: Implement file/case/Vault/account deletion jobs so DB tombstones and object deletion are reconciled before final account-data completion**
- [ ] **Step 6: Run tests/build**
- [ ] **Step 7: Commit and PR to `develop`**

Commit: `feat: add case export and deletion flow`.

---

### Task FE-003: Complete case/export/privacy UI and application states

**Role:** Frontend Agent

**Branch:** `agent/해바라기/frontend/case-export-privacy`

**Depends on:** FE-002, BE-005

**Produces:** case mode, evidence checklist, export review/download, privacy/account deletion UX, complete product-state coverage.

- [ ] **Step 1: Write failing tests for neutral checklist wording and disclaimer visibility**
- [ ] **Step 2: Implement case selection and evidence linking**
- [ ] **Step 3: Implement export review/exclude/redaction-ready flow**
- [ ] **Step 4: Implement privacy/account deletion confirmations and progress/failure states**
- [ ] **Step 5: Audit all primary routes for loading/empty/invalid/error/permission/retry states**
- [ ] **Step 6: Run component tests/build and mobile/desktop accessibility pass**
- [ ] **Step 7: Commit and PR to `develop`**

Commit: `feat: complete case and privacy experience`.

---

### Task DM-001: Create evidence-based marketing and measurement analysis

**Role:** Data & Marketing Agent

**Branch:** `agent/해바라기/data-marketing/market-measurement`

**Depends on:** FE-003, BE-005

**Files:**
- Create: `docs/marketing/MARKETING_ANALYSIS.md`

**Produces:** product-grounded acquisition/SEO/funnel/analytics/experiment analysis without fabricated performance.

- [ ] **Step 1: Inspect the verified product and real available analytics/data**
- [ ] **Step 2: Separate observed product facts, measured first-party data, sourced external evidence, inference, and experiment hypotheses**
- [ ] **Step 3: If analytics are absent, define events and measurement plan instead of inventing results**
- [ ] **Step 4: Cover privacy implications of analytics in a sensitive evidence product**
- [ ] **Step 5: Commit and PR to `develop`**

Commit: `docs: add evidence vault marketing analysis`.

---

### Task DOC-001: Verify release documentation and write GTM

**Role:** Documentation Agent

**Branch:** `agent/해바라기/documentation/release-docs`

**Depends on:** DM-001

**Files:**
- Update: `README.md`, `PRODUCT.md`, `.env.example` as verified.
- Create/update: setup/run/build/test/deploy/API/architecture/privacy notes as needed.
- Create: `docs/marketing/GO_TO_MARKET.md`.

**Produces:** documentation that matches the actual release candidate and independently verified GTM claims.

- [ ] **Step 1: Re-run or inspect authoritative verification evidence for every documented command/feature**
- [ ] **Step 2: Remove stale foundation-era claims**
- [ ] **Step 3: Independently verify `MARKETING_ANALYSIS.md` and remove unsupported claims**
- [ ] **Step 4: Write `GO_TO_MARKET.md` preserving fact/evidence/hypothesis boundaries**
- [ ] **Step 5: Ensure no secret values or private evidence examples are documented**
- [ ] **Step 6: Commit and PR to `develop`**

Commit: `docs: finalize evidence vault release guidance`.

---

### Task CR-001: Independent code review gate

**Role:** Code Review Agent

**Depends on:** DOC-001 and all required product PRs

**Writer branch:** none unless a separately assigned fix task is created.

- [ ] **Step 1: Inspect actual dependency PR diffs and repository state**
- [ ] **Step 2: Review architecture, ownership boundaries, auth, storage privacy, deletion, legal wording, tests, maintainability, accessibility hooks, and logging**
- [ ] **Step 3: Report Assessment / Evidence / Severity / Impact / Recommendation / Priority / Confidence for material findings**
- [ ] **Step 4: Do not approve based only on another Agent's report**

---

### Task REV-001: Independent reviewer gate

**Role:** Reviewer Agent

**Depends on:** CR-001

- [ ] **Step 1: Independently inspect requirements, PRs, verification, and unresolved Code Review findings**
- [ ] **Step 2: Validate that accepted/rejected review findings have defensible evidence**
- [ ] **Step 3: Block objective security/test/product-contract failures**

---

### Task QA-001: Release-candidate QA

**Role:** QA Agent

**Depends on:** REV-001

- [ ] **Step 1: Run clean install/unit/build/E2E in an environment with required test dependencies**
- [ ] **Step 2: Exercise first complete workflow in a real browser**
- [ ] **Step 3: Test mobile and desktop, keyboard/focus, empty/loading/error/permission/retry states**
- [ ] **Step 4: Explicitly test cross-user isolation, foreign signed-URL denial, deletion, OAuth failure/reuse/state mismatch, upload restrictions, and export privacy**
- [ ] **Step 5: Record exact commands/results; unavailable production services remain blockers**

---

### Task UA-001: First-time user validation

**Role:** User Agent A

**Depends on:** QA-001

- [ ] **Step 1: Use the product with no assumed prior knowledge**
- [ ] **Step 2: Attempt login → first VaultItem → deadline → evidence → case/export flow**
- [ ] **Step 3: Report confusion, trust/privacy concerns, terminology problems, and dead ends with reproducible evidence**

---

### Task UB-001: Experienced user validation

**Role:** User Agent B

**Depends on:** QA-001

- [ ] **Step 1: Exercise repeated-use workflows with multiple VaultItems, deadlines, files, cases, exports, and deletions**
- [ ] **Step 2: Evaluate efficiency, information density, history/navigation, and recovery behavior**
- [ ] **Step 3: Report reproducible friction and regression risk**

---

### Task PE-001: Process evaluation and release recommendation

**Role:** Process Evaluator Agent

**Depends on:** UA-001, UB-001

- [ ] **Step 1: Aggregate only after independent required evidence exists**
- [ ] **Step 2: Distinguish objective blockers from specialist opinions**
- [ ] **Step 3: Produce a release recommendation with unresolved risk/evidence**
- [ ] **Step 4: Do not rewrite specialist judgments as if they were independently observed**

---

## Failure Router Contract

For any blocked task, create a Debug / Problem Router run with:

- failure type,
- severity,
- reproducible evidence,
- affected task/branch/PR,
- chosen route: bounded retry, PM replan, or Product Owner decision,
- reason for the route.

A failed network/provider/credential prerequisite never becomes a fake PASS.

## Integration Gate

A writer task is integrated only when its expected branch, commit, open/merged PR, and verification evidence agree. Final release integration requires the mandatory governance evidence and GitHub PR/check state. `main` is not used as a normal Agent development target.

## Replan Ruling

**Ruling:** Preserve the existing Evidence Vault product concept and useful legacy code, but retire the old repository/role-branch execution model. The dedicated BloomBouquet repository and Luna v3 Agent/DAG/review rules are authoritative from this plan forward.

**Cost if wrong:** legacy changes that were never migrated must be deliberately recreated or cherry-picked as evidence-backed tasks; this is preferable to silently merging ambiguous Playground history into the production project repository.