# Evidence Vault Luna v3 Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the existing Evidence Vault baseline out of the legacy Playground subtree into the dedicated `BloomBouquet/evidence-vault` repository and make the upgraded Luna Agent System v3 workflow authoritative before feature development resumes.

**Architecture:** `main` is release-only, `develop` is the integration branch, and every repository-changing Agent uses `agent/해바라기/<role>/<task>` with a PR into `develop`. The application is flattened to the dedicated repository root; no Playground/Luna runtime files are copied into the product repository.

**Tech Stack:** Git/GitHub repository bootstrap plus the existing Next.js 16 / React 19 / TypeScript / PostgreSQL / Drizzle application baseline.

**Spec:** `AGENTS.md` in this PR is the repository-level Luna v3 operating contract. Legacy source snapshot is `sunwoo162/Playground`, branch `evidence-vault/backend`, commit `101198ba3e367f7d8e21027cacd263e9ad866264`.

## Global Constraints

- Canonical repository: `BloomBouquet/evidence-vault`.
- Release branch: `main`.
- Integration branch: `develop`.
- Writer branch format: `agent/해바라기/<role>/<task>`.
- Writer PR base: `develop`.
- The former `sunwoo162/Playground` Evidence Vault branches are source evidence only and are never merged into this repository.
- The dedicated repository root contains the application directly; there is no nested `evidence-vault/` directory.
- `.foundation-complete` is not migrated.
- No secret or `.env` value is migrated.
- No successful install/test/build result is claimed until it is run in an environment with dependency-registry access.
- Production implementation after migration follows RED → verify RED → minimal GREEN → verify GREEN → refactor.

---

### Task 1: PM Agent — install the Luna v3 repository contract

**Role:** PM Agent

**Branch:** `agent/해바라기/pm/luna-v3-replan`

**Files:**
- Create: `AGENTS.md`
- Create: `docs/superpowers/plans/2026-08-27-evidence-vault-luna-v3-replan.md`
- Create: `docs/LUNA_TASK_DAG.md`

**Interfaces:**
- Consumes: the upgraded Luna Project Teams contract and the approved Evidence Vault scope.
- Produces: repository rules and the authoritative post-migration Task DAG used by all later Agents.

- [x] **Step 1: Verify the dedicated repository exists and is writable**

Repository: `BloomBouquet/evidence-vault`.

Expected: repository exists with push/admin permission.

- [x] **Step 2: Initialize `main`**

Initial file: `README.md`.

Commit:

```bash
git commit -m "chore: initialize evidence vault repository"
```

Expected: `main` has an initial commit and no application code is falsely described as migrated.

- [x] **Step 3: Create the integration branch**

```bash
git branch develop main
```

Expected: `develop` starts at the initial `main` commit.

- [x] **Step 4: Create the PM task branch**

```bash
git branch 'agent/해바라기/pm/luna-v3-replan' develop
```

Expected: the branch follows the Luna v3 naming contract.

- [x] **Step 5: Persist the Luna v3 rules**

Create `AGENTS.md` with the 15 Team 해바라기 Agent roles, independent-judgment rules, Failure Router, 꽃다발 auth guardrails, legal/privacy guardrails, release governance, and completion gate.

- [ ] **Step 6: Persist the post-migration Task DAG**

Create `docs/LUNA_TASK_DAG.md` with exact task IDs, roles, dependencies, branch names, and release-review topology.

- [ ] **Step 7: Open the PM PR to `develop`**

Title:

```text
refactor : Luna Agent System v3 실행 구조 재적용
```

Expected: PR base is `develop`, head is `agent/해바라기/pm/luna-v3-replan`.

---

### Task 2: Backend Agent — migrate the verified legacy baseline

**Role:** Backend Agent

**Branch:** `agent/해바라기/backend/migrate-baseline`

**Depends on:** Task 1 merged into `develop`.

**Source:** `sunwoo162/Playground@101198ba3e367f7d8e21027cacd263e9ad866264`, directory `evidence-vault/` only.

**Files to create at the new repository root:**
- `.env.example`
- `.gitignore`
- `PRODUCT.md`
- `drizzle.config.ts`
- `next-env.d.ts`
- `next.config.ts`
- `package.json`
- `postcss.config.mjs`
- `tsconfig.json`
- `vitest.config.ts`
- `app/api/health/route.ts`
- `app/globals.css`
- `app/layout.tsx`
- `app/page.tsx`
- `src/auth/callback.test.ts`
- `src/auth/login-attempt.ts`
- `src/auth/pkce.test.ts`
- `src/auth/pkce.ts`
- `src/components/legal-disclaimer.tsx`
- `src/db/client.ts`
- `src/db/schema.ts`
- `src/domain/case.ts`
- `src/domain/date.ts`
- `src/domain/deadline.test.ts`
- `src/domain/deadline.ts`
- `src/domain/evidence.ts`
- `src/domain/export.ts`
- `src/domain/vault-item.test.ts`
- `src/domain/vault-item.ts`
- `src/repositories/case-repository.ts`
- `src/repositories/evidence-repository.ts`
- `src/repositories/export-repository.ts`
- `src/repositories/ownership-contract.test.ts`
- `src/repositories/session-repository.ts`
- `src/repositories/vault-repository.ts`
- `src/server/health.test.ts`
- `src/server/health.ts`
- `src/test/setup.ts`

**Files explicitly not copied:**
- `evidence-vault/.foundation-complete`
- any file outside the legacy `evidence-vault/` subtree
- `.env`, `.env.local`, generated local data, build output, coverage output, tokens, credentials, or signed URLs

**Files to create after the baseline is copied:**
- `pnpm-lock.yaml` — generated by real `pnpm install`
- `.github/workflows/ci.yml`

**File to replace:**
- `README.md` — replace the initialization-only README with the verified current status.

**Interfaces:**
- Consumes: the exact legacy snapshot above and the Luna v3 rules merged from Task 1.
- Produces: a standalone repository baseline from which all feature Agents branch.

- [ ] **Step 1: Create the Backend migration branch from current `develop`**

```bash
git switch develop
git pull --ff-only
git switch -c 'agent/해바라기/backend/migrate-baseline'
```

Expected: branch HEAD equals current `develop` before migration changes.

- [ ] **Step 2: Copy only the listed legacy files and flatten `evidence-vault/` to repository root**

Expected: `package.json` is at repository root and no `evidence-vault/evidence-vault` nesting exists.

- [ ] **Step 3: Verify prohibited migration artifacts are absent**

Run:

```bash
test ! -e .foundation-complete
test ! -e .env
test ! -d .data
test ! -d node_modules
test ! -d .next
```

Expected: every command exits 0.

- [ ] **Step 4: Install dependencies and create the lockfile**

Run:

```bash
pnpm install
```

Expected: command exits 0 and creates/updates `pnpm-lock.yaml`. If registry access fails, record the exact failure and route the task to Debug / Problem Router; do not proceed as PASS.

- [ ] **Step 5: Verify migrated tests before changing behavior**

Run:

```bash
pnpm test:run
```

Expected: all migrated tests pass. A failing migrated test blocks the migration task until the drift is understood.

- [ ] **Step 6: Verify the production build**

Run:

```bash
pnpm build
```

Expected: command exits 0. Missing real production credentials are not invented; build-time configuration must follow the app's documented env contract.

- [ ] **Step 7: Add CI for integration/release PRs**

Create `.github/workflows/ci.yml` with these jobs on pull requests targeting `develop` or `main`:

```text
checkout → setup pnpm/node → pnpm install --frozen-lockfile → pnpm test:run → pnpm build
```

Expected: no deployment or secret-dependent step is included in this baseline CI.

- [ ] **Step 8: Replace README with verified migration status**

README must state:
- canonical repository and local run commands,
- currently implemented baseline,
- currently incomplete product areas,
- required 꽃다발/PostgreSQL/private-storage production inputs,
- that application credentials are never stored in the repository.

- [ ] **Step 9: Commit the migration as one logical snapshot**

```bash
git add .
git commit -m "chore: migrate evidence vault baseline"
```

Expected: commit contains only the listed app baseline, lockfile, CI, and README update.

- [ ] **Step 10: Push and open a PR to `develop`**

```bash
git push -u origin 'agent/해바라기/backend/migrate-baseline'
```

PR title:

```text
refactor : 증빙함 전용 저장소 기준선 이관
```

Expected: PR base `develop`; verification evidence includes the exact install/test/build commands and results.

---

## Self-Review

- Spec coverage: canonical repository, branch/PR rules, legacy snapshot provenance, flattening, prohibited artifacts, verification, CI, and handoff to the new Task DAG are covered.
- Placeholder scan: no `TBD`, `TODO`, implied file names, or unspecified migration file sets remain.
- Type/interface consistency: this migration plan changes no production interfaces; later product interfaces are defined in task-specific implementation plans created by the owning Agent after Task 2 establishes the real repository baseline.

## Execution Handoff

After Task 1 merges, Task 2 is the only dependency-ready repository-changing task from this migration plan. Product feature implementation does not resume until Task 2 is verified and merged into `develop`.