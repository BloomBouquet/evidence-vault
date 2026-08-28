# Evidence Vault Integration Preview Deployment Design

Date: 2026-08-28
Team: 해바라기
Owning Agent: Backend Agent
Repository: `BloomBouquet/evidence-vault`
Integration branch: `develop`
Release branch: `main`

## 1. Purpose

Deploy the current `develop` integration state of Evidence Vault to a real HTTPS URL so the team can validate the actual Next.js runtime, PostgreSQL persistence boundary, shared 꽃다발 OAuth flow, and BloomBouquet evaluator against a reachable application before formal release promotion.

This deployment is an **integration preview**, not a production-release declaration. The repository's existing release governance remains authoritative: `main` is the release branch and release promotion still requires the documented Review → QA → User A/B → Process Evaluator evidence and removal of objective blockers.

## 2. Approved public endpoint

The integration preview uses:

- Application URL: `https://evidence-vault.https.gsmsv.site`
- OAuth callback: `https://evidence-vault.https.gsmsv.site/auth/bouquet/callback`
- BloomBouquet / 꽃다발 provider: `https://playground.https.gsmsv.site`

The deployment must not claim these external routes are live until DNS/TLS/Nginx and an external or server-side HTTP smoke check prove them reachable.

## 3. Deployment topology

Evidence Vault runs as its own Next.js process on the existing authorized Ubuntu host.

- Repository directory: `/home/ubuntu/evidence-vault`
- Process manager: PM2
- PM2 process name: `evidence-vault-preview`
- Runtime: Node.js 22 + pnpm 10.33.0
- Next.js mode: `next build` followed by `next start`
- Internal bind: loopback only
- Preferred internal port: `3011`
- Reverse proxy: Nginx `server_name evidence-vault.https.gsmsv.site` → `http://127.0.0.1:3011`

Before claiming port 3011, deployment must verify that the port is either unused or already owned by the Evidence Vault preview process. If another process owns it, deployment stops rather than killing or replacing unrelated software.

No Evidence Vault user traffic is served directly from the internal port.

## 4. Source and branch policy

Repository-changing deployment work uses:

`agent/해바라기/backend/integration-preview-deploy`

The PR base is `develop`, in accordance with repository rules.

The preview deploys a verified `develop` commit. It does **not** fast-forward, merge, or force-push `main`.

A later release promotion to `main` is a separate decision after the existing release DAG reaches its release gate.

## 5. Production-like environment contract

The preview runtime uses a server-owned environment file that is never committed:

`/home/ubuntu/evidence-vault/.env.production`

Required values:

- `NODE_ENV=production`
- `PORT=3011`
- `APP_BASE_URL=https://evidence-vault.https.gsmsv.site`
- `DATABASE_URL=<dedicated Evidence Vault PostgreSQL connection>`
- `SESSION_SECRET=<cryptographically random value, at least 32 bytes>`
- `BOUQUET_BASE_URL=https://playground.https.gsmsv.site`
- `BOUQUET_CLIENT_ID=<client id issued by BloomBouquet for the submitted preview>`
- `BOUQUET_REDIRECT_URI=https://evidence-vault.https.gsmsv.site/auth/bouquet/callback`

Storage remains outside this deployment's release claim. The current preview must not pretend private evidence upload is production-ready if S3-compatible storage has not yet passed its own implementation and QA task. Existing unfinished product areas remain visible blockers rather than being represented as complete.

Secrets must never be printed in workflow logs, PM2 output, PRs, repository files, or user-facing errors.

## 6. PostgreSQL strategy

Evidence Vault uses PostgreSQL in the preview; local-file or SQLite substitution is prohibited.

The deployment creates or uses a dedicated database and role rather than reusing another product's application credentials. The database must be reachable from the Evidence Vault process through `DATABASE_URL` and should be network-restricted to the application host when hosted locally.

The current repository has schema definitions and Drizzle configuration, but committed migration artifacts are required before a production-like migration can run. Implementation therefore adds a checked-in initial migration under the repository's configured `./drizzle` output and validates it in CI.

Deployment order:

1. verify PostgreSQL connectivity;
2. create a backup/snapshot when the database already contains data;
3. run forward-only committed Drizzle migrations;
4. build/start the application;
5. run health/auth smoke checks.

The deploy workflow must not perform an automatic down-migration. If migration fails, the application is not restarted onto the new code.

## 7. CI/CD behavior

A dedicated deploy workflow is added for the integration preview.

Trigger policy:

- automatic deploy only from the approved integration source after the deployment PR is merged to `develop`, or an explicitly dispatched workflow targeting a concrete `develop` SHA;
- never deploy arbitrary PR head code directly to the public preview URL;
- never promote `main` as a side effect of preview deployment.

Required stages:

1. checkout exact SHA;
2. `pnpm install --frozen-lockfile`;
3. `pnpm test:run`;
4. `pnpm build`;
5. validate required deployment files and committed migrations;
6. connect to the authorized host using repository secrets;
7. fetch/reset the server checkout to the exact verified SHA;
8. validate server environment without printing values;
9. verify PostgreSQL connectivity and run migrations;
10. start/reload `evidence-vault-preview` with PM2;
11. verify `http://127.0.0.1:3011/api/health`;
12. verify Nginx-facing HTTPS health/root when the domain is available;
13. save the PM2 process list only after smoke checks pass.

A failed build, migration, process start, or health check fails the deployment run. The workflow must not report success merely because SSH commands completed.

## 8. Nginx and TLS boundary

Nginx owns public TLS termination and forwards only to `127.0.0.1:3011`.

The deployment first inspects the existing server's certificate and wildcard/domain routing model. It reuses the existing trusted TLS mechanism only when `evidence-vault.https.gsmsv.site` is actually covered.

If DNS or certificate coverage is missing, the deploy stops at a clear infrastructure blocker. It must not disable TLS validation, expose plain HTTP as the final URL, or fabricate external availability.

The Nginx change is syntax-tested with `nginx -t` before reload. A failed test leaves the previous configuration active.

## 9. 꽃다발 OAuth registration race

BloomBouquet currently creates an authenticated submission's OAuth client only **after** the submission record is saved. The generated ID is submission-specific (`bouquet-submission-{submissionId}`), and the same operation immediately creates an evaluator Run in `QUEUED` state.

Therefore Evidence Vault cannot know its final production-like `BOUQUET_CLIENT_ID` before the BloomBouquet submission exists. Starting evaluation immediately would create a race between evaluator execution and application reconfiguration.

This design resolves that race operationally without changing BloomBouquet's authentication model in this task.

### Safe evaluator pause procedure

Before publishing the first authenticated Evidence Vault submission:

1. inspect BloomBouquet evaluation state;
2. if any unrelated Run is `RUNNING`, wait for it to reach a terminal/safe state;
3. stop only the `bloom-worker` PM2 process at that safe boundary;
4. keep the local evaluator LLM and BloomBouquet web/backend online;
5. publish the Evidence Vault submission through the normal authenticated BloomBouquet management flow;
6. capture the returned `bouquetClientId` without exposing session cookies or secrets;
7. update only `BOUQUET_CLIENT_ID` in Evidence Vault's server-owned environment;
8. restart `evidence-vault-preview`;
9. verify application health and OAuth authorization-start redirect using the issued client ID and exact callback URI;
10. resume `bloom-worker`;
11. confirm the queued Evidence Vault Run is claimed and proceeds normally.

If the worker cannot be paused safely, submission publication is postponed. No evaluator run is intentionally sabotaged to make the registration sequence easier.

## 10. BloomBouquet project registration

The first registered project is:

- Team: `해바라기`
- Project name: `증빙함`
- Project slug: `evidence-vault`
- Frontend/backend repository URL: `https://github.com/BloomBouquet/evidence-vault`
- Demo URL: `https://evidence-vault.https.gsmsv.site`
- `requiresAuth=true`
- Auth redirect URI: `https://evidence-vault.https.gsmsv.site/auth/bouquet/callback`

Because Evidence Vault is a single Next.js repository containing both UI and server/BFF code, the same canonical repository may be recorded as the primary repository evidence rather than fabricating a nonexistent second repository.

Registration must occur through the authenticated BloomBouquet owner flow. The deployment task must not bypass bouquet authentication by writing directly to the BloomBouquet database or inventing an owner identity.

If no controllable authenticated browser/session is available to the automation environment, that one owner action is an explicit manual gate. The task may prepare and deploy everything around it but must not claim that registration happened until the real authenticated action is observed.

## 11. OAuth end-to-end acceptance

After the issued BloomBouquet client ID is installed, the preview must prove the real flow:

1. anonymous user opens Evidence Vault;
2. login action routes through Evidence Vault's server `/auth/bouquet/start`;
3. provider authorization uses the registered `bouquet-submission-*` client and PKCE S256;
4. callback returns only to the exact registered HTTPS URI;
5. token exchange and `/userinfo` occur server-side;
6. Evidence Vault creates its own HttpOnly/Secure application session;
7. `/auth/session` reports authenticated state without exposing provider tokens;
8. protected `/dashboard` renders only after server-side session verification;
9. Evidence Vault logout invalidates only the Evidence Vault application session.

Provider code, access token, PKCE verifier, session secret, raw application session token, and database credentials must not appear in browser persistent storage or logs.

## 12. BloomBouquet evaluator acceptance

After OAuth smoke succeeds and `bloom-worker` resumes, the registration is considered evaluation-complete only when evidence shows:

- Run observed as `QUEUED` then claimed/`RUNNING`;
- required independent evaluator roles persisted;
- Run reaches `COMPLETED` rather than being inferred from worker uptime;
- overall score/stars/report are readable from the public evaluation endpoint;
- evaluator evidence does not claim unobserved authenticated behavior as observed;
- worker remains online after completion.

A failed/partial evaluation remains visible as a failed/partial result; the task does not overwrite it or manually mark it complete.

## 13. Rollback and failure handling

Application rollback is code-first:

- retain the previously deployed verified SHA;
- if the new process or smoke check fails after restart, reset the server checkout to the previous SHA and restart the previous PM2 process configuration;
- do not roll database schema backward automatically;
- if a forward migration partially succeeds, stop and route the failure through the Debug / Problem Router with database evidence before further writes.

Nginx rollback restores the last known-good site config if syntax or runtime validation fails.

OAuth/BloomBouquet registration is not silently deleted as a rollback technique because evaluation/report records are versioned evidence. A bad preview submission is retained as historical evidence and superseded by a new version after correction.

## 14. Security and privacy constraints

- no direct database bypass for BloomBouquet owner registration;
- no secrets in repository or workflow output;
- no public evidence-object storage introduced by this task;
- loopback-only internal app port;
- exact HTTPS callback URI;
- HttpOnly/Secure production cookies remain mandatory;
- no provider token/code/verifier in browser localStorage/sessionStorage;
- no disabling TLS verification for convenience;
- no unrelated PM2 process termination;
- no claim that unfinished evidence upload/export/deletion functionality is release-ready.

## 15. Test strategy

Implementation follows RED → GREEN TDD where repository behavior changes.

Automated checks cover at minimum:

- deployment policy contract: correct branch, URL, process name, port, migration and health gates;
- production auth configuration accepts only the approved HTTPS callback/base URLs;
- committed migration presence and schema consistency;
- existing `pnpm test:run` regression suite;
- existing `pnpm build` production build;
- deployment workflow syntax/static policy checks;
- server-side health smoke;
- OAuth start/callback/session/logout regression tests.

Operational verification records the exact deployed commit, PM2 online state, database migration result, health response, OAuth redirect/callback result, and BloomBouquet evaluation Run state without recording secret values.

## 16. Non-goals

This task does not:

- declare Evidence Vault feature-complete;
- promote `develop` to `main`;
- implement unfinished Vault CRUD, evidence upload, export, deletion, or marketing tasks;
- change BloomBouquet's submission-specific OAuth client architecture;
- introduce a separate Evidence Vault password/account system;
- bypass the existing Luna review/release DAG.

## 17. Completion criteria

The integration-preview deployment task is complete when all of the following are true:

- deployment code is merged to `develop` through a normal Agent PR;
- a verified `develop` SHA is running as `evidence-vault-preview` behind the approved HTTPS domain;
- PostgreSQL migration and application health are proven;
- exact OAuth callback routing is live;
- a real authenticated BloomBouquet owner has registered the `해바라기 / 증빙함` project and authenticated submission;
- the issued client ID is installed without secret leakage;
- actual 꽃다발 login → callback → Evidence Vault session → protected dashboard → logout E2E succeeds;
- evaluator worker is resumed and the real Evidence Vault evaluation Run reaches a truthful terminal state;
- unresolved product/release blockers remain documented and `main` is untouched.
