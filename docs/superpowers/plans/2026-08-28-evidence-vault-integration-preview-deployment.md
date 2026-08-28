# Evidence Vault Integration Preview Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deploy Evidence Vault `develop` to a real HTTPS integration-preview endpoint, prove PostgreSQL + shared 꽃다발 OAuth + BloomBouquet evaluation, without promoting `main` or bypassing the repository release DAG.

**Architecture:** Keep deployment configuration explicit and repository-auditable: a checked-in preview contract, committed Drizzle migration, a loopback-only Next.js PM2 start script, and one GitHub Actions deployment workflow that verifies the exact SHA before SSH deployment. Bootstrap uses a temporary non-evaluator OAuth client only until the normal BloomBouquet authenticated submission creates the real `bouquet-submission-*` client; evaluator execution is resumed only after the real client is installed and OAuth smoke succeeds.

**Tech Stack:** Next.js 16.3.3, React 19, TypeScript, Vitest, PostgreSQL, Drizzle ORM / drizzle-kit, Node.js 22, pnpm 10.33.0, PM2, Nginx, GitHub Actions, 꽃다발 OAuth Authorization Code + PKCE S256.

**Spec:** `docs/superpowers/specs/2026-08-28-evidence-vault-integration-preview-deployment-design.md`

## Global Constraints

- Integration URL: `https://evidence-vault.https.gsmsv.site`.
- OAuth callback: `https://evidence-vault.https.gsmsv.site/auth/bouquet/callback`.
- Provider: `https://playground.https.gsmsv.site`.
- Server checkout: `/home/ubuntu/evidence-vault`.
- PM2 process: `evidence-vault-preview`.
- Internal bind: `127.0.0.1:3011` only.
- `develop` is preview source; `main` is not promoted by this work.
- Server secrets stay in `/home/ubuntu/evidence-vault/.env.production` with mode 600 and are never printed.
- PostgreSQL is mandatory; no SQLite/local-file database substitution.
- No direct BloomBouquet DB writes and no fabricated owner identity.
- A queued evaluator run is not released until the issued submission client ID is installed and OAuth smoke succeeds.
- Commits are small/logical and written in English; PR base is `develop`.

---

### Task 1: Lock the preview deployment contract with RED → GREEN policy tests

**Files:**
- Create: `deploy/preview-contract.json`
- Create: `src/deployment/preview-contract.test.ts`
- Modify: `src/auth/config.test.ts`

**Interfaces:**
- Produces repository-owned constants for `publicUrl`, `oauthCallback`, `providerUrl`, `serverDir`, `processName`, `port`, `integrationBranch`, and `releaseBranch`.
- Later deployment scripts/workflow consume the same exact values or are checked against them by the policy test.

- [ ] **Step 1: Write the failing deployment policy test**

```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const contract = JSON.parse(readFileSync("deploy/preview-contract.json", "utf8"));

it("pins the approved Evidence Vault integration preview boundary", () => {
  expect(contract).toEqual({
    publicUrl: "https://evidence-vault.https.gsmsv.site",
    oauthCallback: "https://evidence-vault.https.gsmsv.site/auth/bouquet/callback",
    providerUrl: "https://playground.https.gsmsv.site",
    serverDir: "/home/ubuntu/evidence-vault",
    processName: "evidence-vault-preview",
    port: 3011,
    integrationBranch: "develop",
    releaseBranch: "main",
  });
});
```

Also add a production auth-config case proving the exact approved HTTPS URLs are accepted:

```ts
it("accepts the approved integration-preview production URLs", () => {
  const config = getAuthConfig({
    ...validEnv,
    NODE_ENV: "production",
    APP_BASE_URL: "https://evidence-vault.https.gsmsv.site",
    BOUQUET_BASE_URL: "https://playground.https.gsmsv.site",
    BOUQUET_CLIENT_ID: "evidence-vault-preview-bootstrap",
    BOUQUET_REDIRECT_URI: "https://evidence-vault.https.gsmsv.site/auth/bouquet/callback",
  } as NodeJS.ProcessEnv);
  expect(config.secureCookies).toBe(true);
});
```

- [ ] **Step 2: Run the tests and verify RED**

Run: `pnpm test:run -- src/deployment/preview-contract.test.ts src/auth/config.test.ts`

Expected: FAIL because `deploy/preview-contract.json` does not exist.

- [ ] **Step 3: Add the minimal contract JSON**

```json
{
  "publicUrl": "https://evidence-vault.https.gsmsv.site",
  "oauthCallback": "https://evidence-vault.https.gsmsv.site/auth/bouquet/callback",
  "providerUrl": "https://playground.https.gsmsv.site",
  "serverDir": "/home/ubuntu/evidence-vault",
  "processName": "evidence-vault-preview",
  "port": 3011,
  "integrationBranch": "develop",
  "releaseBranch": "main"
}
```

- [ ] **Step 4: Re-run the focused tests**

Run: `pnpm test:run -- src/deployment/preview-contract.test.ts src/auth/config.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add deploy/preview-contract.json src/deployment/preview-contract.test.ts src/auth/config.test.ts
git commit -m "test: lock integration preview deployment contract"
```

---

### Task 2: Add and verify the committed initial PostgreSQL migration

**Files:**
- Create: `drizzle/0000_evidence_vault_initial.sql`
- Create: `drizzle/meta/_journal.json`
- Create: `src/db/migration-contract.test.ts`
- Modify: `.github/workflows/ci.yml`

**Interfaces:**
- Produces a committed migration consumable by existing `pnpm db:migrate` (`drizzle-kit migrate`).
- CI uses an ephemeral PostgreSQL 16 service and the same migration command production will use.

- [ ] **Step 1: Write the failing migration contract test**

```ts
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

it("ships a committed initial PostgreSQL migration", () => {
  expect(existsSync("drizzle/0000_evidence_vault_initial.sql")).toBe(true);
  expect(existsSync("drizzle/meta/_journal.json")).toBe(true);
  const sql = readFileSync("drizzle/0000_evidence_vault_initial.sql", "utf8");
  for (const table of [
    "ev_users", "ev_app_sessions", "ev_vault_items", "ev_deadlines",
    "ev_evidence_events", "ev_evidence_files", "ev_cases",
    "ev_case_evidence_links", "ev_export_packets", "ev_deletion_jobs",
  ]) {
    expect(sql).toContain(`\"${table}\"`);
  }
});
```

- [ ] **Step 2: Verify RED**

Run: `pnpm test:run -- src/db/migration-contract.test.ts`

Expected: FAIL because the migration files do not exist.

- [ ] **Step 3: Generate the migration from the current schema**

Run locally or in an isolated executor with a non-production `DATABASE_URL`:

```bash
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/evidence_vault pnpm exec drizzle-kit generate --name evidence_vault_initial
```

The committed SQL must create exactly the current `src/db/schema.ts` tables, PK/FK/unique constraints, and cascade/set-null behavior. Do not hand-edit production data or add seed users.

- [ ] **Step 4: Add a PostgreSQL service/migration gate to CI**

Add to `.github/workflows/ci.yml` verify job:

```yaml
services:
  postgres:
    image: postgres:16-alpine
    env:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: evidence_vault_ci
    ports:
      - 5432:5432
    options: >-
      --health-cmd "pg_isready -U postgres -d evidence_vault_ci"
      --health-interval 5s
      --health-timeout 5s
      --health-retries 10
```

and before unit tests:

```yaml
- name: Verify committed database migrations
  env:
    DATABASE_URL: postgresql://postgres:postgres@127.0.0.1:5432/evidence_vault_ci
  run: pnpm db:migrate
```

- [ ] **Step 5: Run migration + tests + build**

Run:

```bash
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/evidence_vault_ci pnpm db:migrate
pnpm test:run
pnpm build
```

Expected: migration succeeds, tests PASS, build PASS.

- [ ] **Step 6: Commit**

```bash
git add drizzle src/db/migration-contract.test.ts .github/workflows/ci.yml
git commit -m "feat: add verified PostgreSQL migration gate"
```

---

### Task 3: Add loopback-only PM2 runtime and safe server deployment script

**Files:**
- Create: `scripts/start-preview.sh`
- Create: `scripts/deploy-preview.sh`
- Create: `src/deployment/server-scripts.test.ts`
- Modify: `.gitignore`

**Interfaces:**
- `scripts/start-preview.sh` consumes `/home/ubuntu/evidence-vault/.env.production` and starts Next.js on `127.0.0.1:${PORT:-3011}`.
- `scripts/deploy-preview.sh <verified-sha>` consumes the exact verified SHA and performs install → migration → build → PM2 restart → loopback health with rollback to the previous SHA if the application restart/smoke fails.

- [ ] **Step 1: Write failing static safety tests**

Test must assert:

```ts
const start = readFileSync("scripts/start-preview.sh", "utf8");
const deploy = readFileSync("scripts/deploy-preview.sh", "utf8");
expect(start).toContain("127.0.0.1");
expect(start).toContain(".env.production");
expect(deploy).toContain("git reset --hard");
expect(deploy).toContain("pnpm db:migrate");
expect(deploy).toContain("pnpm build");
expect(deploy).toContain("pm2");
expect(deploy).toContain("127.0.0.1:3011/api/health");
expect(deploy).not.toMatch(/cat .*\.env\.production/);
expect(deploy).not.toContain("pm2 delete all");
```

- [ ] **Step 2: Verify RED**

Run: `pnpm test:run -- src/deployment/server-scripts.test.ts`

Expected: FAIL because scripts do not exist.

- [ ] **Step 3: Implement `scripts/start-preview.sh`**

Exact behavior:

```bash
#!/usr/bin/env bash
set -euo pipefail
APP_DIR="/home/ubuntu/evidence-vault"
ENV_FILE="$APP_DIR/.env.production"
test -f "$ENV_FILE" || { echo "preview environment missing" >&2; exit 1; }
set -a
. "$ENV_FILE"
set +a
: "${DATABASE_URL:?DATABASE_URL is required}"
: "${SESSION_SECRET:?SESSION_SECRET is required}"
: "${APP_BASE_URL:?APP_BASE_URL is required}"
: "${BOUQUET_BASE_URL:?BOUQUET_BASE_URL is required}"
: "${BOUQUET_CLIENT_ID:?BOUQUET_CLIENT_ID is required}"
: "${BOUQUET_REDIRECT_URI:?BOUQUET_REDIRECT_URI is required}"
exec pnpm start --hostname 127.0.0.1 --port "${PORT:-3011}"
```

- [ ] **Step 4: Implement `scripts/deploy-preview.sh`**

The script must:

1. require a 40-hex verified SHA argument;
2. verify `.env.production` exists and is permission 600/owner-readable only;
3. refuse port 3011 when a non-`evidence-vault-preview` process owns it;
4. record `PREVIOUS_SHA=$(git rev-parse HEAD)`;
5. `git fetch origin develop` and confirm the requested SHA is contained in `origin/develop`;
6. `git reset --hard "$VERIFIED_SHA"`;
7. activate pnpm 10.33.0, `pnpm install --frozen-lockfile`, `pnpm db:migrate`, `pnpm build`;
8. restart only `evidence-vault-preview` via `pm2 start scripts/start-preview.sh --name evidence-vault-preview --interpreter bash --update-env`;
9. poll `http://127.0.0.1:3011/api/health` for at most 60 seconds;
10. on post-restart smoke failure, reset to `PREVIOUS_SHA`, reinstall/build if needed, restart the previous code, and exit non-zero;
11. never automatically reverse database migrations;
12. call `pm2 save` only after health succeeds.

- [ ] **Step 5: Re-run focused tests**

Run: `pnpm test:run -- src/deployment/server-scripts.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add scripts/start-preview.sh scripts/deploy-preview.sh src/deployment/server-scripts.test.ts .gitignore
git commit -m "feat: add safe integration preview runtime"
```

---

### Task 4: Add GitHub Actions preview deployment with an infrastructure probe gate

**Files:**
- Create: `.github/workflows/deploy-preview.yml`
- Create: `src/deployment/workflow-contract.test.ts`
- Create: `deploy/nginx/evidence-vault-preview.conf.template`

**Interfaces:**
- Workflow consumes existing server route `ssh.gsmsv.site:24136`, user `ubuntu`, and repository/org secret `SSH_PASSWORD` only after CI verification.
- `workflow_dispatch` input `mode` is `probe` or `deploy`; `probe` is read-only infrastructure discovery, while `deploy` runs the exact verified SHA through `scripts/deploy-preview.sh`.

- [ ] **Step 1: Write failing workflow policy tests**

Assert the workflow:

```ts
expect(yaml).toContain("workflow_dispatch:");
expect(yaml).toContain("mode:");
expect(yaml).toContain("probe");
expect(yaml).toContain("deploy");
expect(yaml).toContain("ssh.gsmsv.site");
expect(yaml).toContain("24136");
expect(yaml).toContain("secrets.SSH_PASSWORD");
expect(yaml).toContain("scripts/deploy-preview.sh");
expect(yaml).not.toContain("pm2 delete all");
expect(yaml).not.toContain("git push origin main");
```

- [ ] **Step 2: Verify RED**

Run: `pnpm test:run -- src/deployment/workflow-contract.test.ts`

Expected: FAIL because workflow/template do not exist.

- [ ] **Step 3: Add the Nginx template**

Use a template that contains only the upstream/site behavior and no guessed certificate path:

```nginx
server {
    listen 80;
    server_name evidence-vault.https.gsmsv.site;

    location / {
        proxy_pass http://127.0.0.1:3011;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

TLS installation remains conditional on the server's existing trusted certificate mechanism; the deploy does not invent certificate file paths.

- [ ] **Step 4: Implement `.github/workflows/deploy-preview.yml`**

Required behavior:

- `workflow_dispatch` with `mode: probe|deploy`, default `probe`;
- `push` on `develop` may run verification but public deployment only executes when deployment workflow is explicitly dispatched in `deploy` mode during bootstrap;
- checkout exact `github.sha`, install pnpm 10.33.0 + Node 22, run `pnpm install --frozen-lockfile`, `pnpm test:run`, `pnpm build`;
- SSH probe prints only non-secret facts: server working directory existence, Node/pnpm/pm2/postgres/nginx presence, port 3011 ownership, Nginx `server_name` coverage, certificate coverage summary, and whether `.env.production` exists (never its contents);
- deploy mode calls `scripts/deploy-preview.sh "$GITHUB_SHA"` on the server only after the verification job succeeds;
- deployment fails clearly if `SSH_PASSWORD`, environment file, PostgreSQL, DNS/TLS route, or required runtime is unavailable.

- [ ] **Step 5: Run focused and full checks**

Run:

```bash
pnpm test:run -- src/deployment/workflow-contract.test.ts
pnpm test:run
pnpm build
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add .github/workflows/deploy-preview.yml deploy/nginx/evidence-vault-preview.conf.template src/deployment/workflow-contract.test.ts
git commit -m "ci: add integration preview deployment workflow"
```

---

### Task 5: CI review, merge to `develop`, and run read-only infrastructure probe

**Files:**
- Modify as needed only when CI/probe produces reproducible evidence.
- Update: `docs/VERIFICATION.md` after successful probe with non-secret facts only.

**Interfaces:**
- Produces a verified `develop` SHA and infrastructure facts needed for deployment.

- [ ] **Step 1: Run the complete repository verification before PR**

```bash
pnpm install --frozen-lockfile
pnpm test:run
pnpm build
```

Expected: all PASS.

- [ ] **Step 2: Open PR to `develop` using the required repository PR format**

Title: `feat : 증빙함 Integration Preview 배포 경로 추가`

Body must use exactly the user's standard sections in this order: `# ✨ PR 내용` → 코드 변경 사항 → 변경 이유 → 구현 방법 → 영향 범위 → 테스트 → 테스트 결과/참고 → 반영 브랜치 `develop`.

- [ ] **Step 3: Independent review gate**

Review the actual PR diff for:

- secret leakage;
- arbitrary branch deployment;
- `main` mutation;
- unsafe PM2/process kill;
- direct public bind;
- database rollback/destructive SQL;
- OAuth callback mismatch;
- health-check false positives.

Any blocker is fixed on the same task branch and CI is re-run.

- [ ] **Step 4: Merge only after CI PASS**

Merge into `develop`; do not merge/promote `main`.

- [ ] **Step 5: Dispatch `deploy-preview.yml` in `probe` mode against the merged `develop` SHA**

Record only safe facts. If SSH secret is unavailable or infra is missing, mark the concrete blocker and stop before any deployment mutation.

- [ ] **Step 6: Commit verified deployment notes only if repository documentation changes are needed**

No secret values, passwords, DB URLs, token values, or certificate private-key paths are recorded.

---

### Task 6: Bootstrap the preview runtime and normal BloomBouquet registration

**Files:**
- Server-owned only (not committed): `/home/ubuntu/evidence-vault/.env.production`
- Repository documentation update after evidence: `docs/VERIFICATION.md`

**Interfaces:**
- Consumes the merged `develop` SHA and infrastructure-probe evidence.
- Produces a healthy HTTPS preview and the real `bouquet-submission-*` client ID issued by the normal BloomBouquet submission flow.

- [ ] **Step 1: Provision only missing server prerequisites**

At minimum:

- `/home/ubuntu/evidence-vault` clone of `BloomBouquet/evidence-vault`;
- dedicated PostgreSQL database + role;
- `.env.production` mode 600;
- bootstrap `BOUQUET_CLIENT_ID=evidence-vault-preview-bootstrap` only for pre-registration health boot;
- Nginx route after `nginx -t` succeeds and TLS coverage is confirmed.

Do not create user/product data.

- [ ] **Step 2: Deploy the verified `develop` SHA in `deploy` mode**

Acceptance before registration:

- PM2 `evidence-vault-preview` online;
- loopback `/api/health` succeeds;
- public HTTPS `/api/health` succeeds;
- anonymous root renders;
- OAuth start may fail only at the expected unregistered bootstrap-client boundary; no secret is exposed.

- [ ] **Step 3: Pause evaluator only at a safe boundary**

On the BloomBouquet host:

- verify no unrelated evaluation Run is `RUNNING`;
- stop only PM2 process `bloom-worker`;
- keep BloomBouquet backend/web/evaluator LLM online.

If a run is active, wait; do not terminate or steal its lease.

- [ ] **Step 4: Register Evidence Vault through the authenticated BloomBouquet management UI**

Values:

```text
Team: 해바라기
Project: 증빙함
Slug: evidence-vault
Version: 0.1.0-preview.1
Demo: https://evidence-vault.https.gsmsv.site
Frontend repo: https://github.com/BloomBouquet/evidence-vault
Backend repo: https://github.com/BloomBouquet/evidence-vault
Requires auth: true
Callback: https://evidence-vault.https.gsmsv.site/auth/bouquet/callback
```

If the automation environment cannot control a real authenticated browser/session, this single owner action remains a manual gate; do not bypass it with DB writes.

- [ ] **Step 5: Install the returned real client ID**

Update only `BOUQUET_CLIENT_ID` in `.env.production` to the returned `bouquet-submission-*` value without printing it, then restart only `evidence-vault-preview`.

- [ ] **Step 6: Prove real OAuth E2E**

Verify anonymous → `/auth/bouquet/start` → provider → exact callback → server token/userinfo → Evidence Vault HttpOnly/Secure session → `/auth/session` authenticated → protected `/dashboard` → Evidence Vault logout.

No code/token/verifier/provider access token/raw app-session token may appear in persistent browser storage or logs.

- [ ] **Step 7: Resume evaluator and observe the actual Run**

Start only `bloom-worker`, then observe `QUEUED → RUNNING → COMPLETED`, persisted independent roles, final score/stars/report, and worker-online state. A partial/failed run remains visible and is not manually rewritten.

---

### Task 7: Record verification evidence without declaring release completion

**Files:**
- Modify: `docs/VERIFICATION.md`

**Interfaces:**
- Produces a factual integration-preview record for later QA/User A/B/Process Evaluator work.

- [ ] **Step 1: Add exact non-secret evidence**

Record:

- deployed `develop` SHA;
- deployment workflow run ID/result;
- PM2 process name/online status;
- migration success;
- loopback/public health result;
- public preview URL;
- OAuth callback success/failure result without token details;
- BloomBouquet project/submission/run IDs;
- evaluator terminal status and role count;
- explicit statement that `main` release promotion did not occur.

- [ ] **Step 2: Run documentation-adjacent regression**

```bash
pnpm test:run
pnpm build
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add docs/VERIFICATION.md
git commit -m "docs: record integration preview verification"
```

- [ ] **Step 4: Keep release status explicit**

The preview may be technically reachable and evaluated, but the project remains non-release until the repository's existing `Data & Marketing → Documentation → Code Review → Reviewer → QA → User A/B → Process Evaluator` gate is satisfied and a separate `main` promotion is approved.
