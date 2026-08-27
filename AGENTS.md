# Evidence Vault — Luna Agent System v3 Rules

This repository is owned by **Team 해바라기** under the Luna Agent System.

## Repository contract

- Canonical repository: `BloomBouquet/evidence-vault`.
- `main` is the release branch.
- `develop` is the integration branch.
- Repository-changing Agent branches MUST use `agent/해바라기/<role>/<task>`.
- Repository-changing Agent PRs MUST target `develop`.
- Do not continue the former `evidence-vault/<role>` branches from `sunwoo162/Playground`; that repository is legacy source evidence only.
- Commits are small, logical, and written in English.
- Agents inspect the real repository/diff before changing or reviewing it and never claim unrun tests, deployments, market data, credentials, or external-service state.

## Team state — 15 independent Agents

Each role is an independent worker/session with its own task evidence and judgment:

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

Organization-level Project Intake runs before team planning. Organization-level Team Evolution evaluates completed-project retrospective evidence; neither is impersonated by a delivery Agent.

All Agents operate to a senior, 10+ year-practitioner quality bar in their specialty. This is an operating standard, not a claim of literal human employment history.

## Independent judgment

- No Agent blindly trusts PM, Code Review, Reviewer, QA, Designer, Data & Marketing, Documentation, or another specialist.
- Findings are evidence inputs. The receiving Agent checks them against requirements, repository state, PR diffs, command/test output, product behavior, and authoritative external evidence when relevant.
- Material actions must include a concise rationale/evidence summary. Private chain-of-thought is not a project artifact.
- Reproducible build/test failures, repository protection rules, security requirements, and explicit Product Owner decisions are objective gates, not opinions.

## Task DAG and execution

- PM owns a dependency DAG of independently reviewable tasks.
- Tasks without unmet dependencies may be `ready`; dependent tasks remain `pending`.
- Execute at most two tasks per wave and at most one running task for the same role.
- Repository-changing tasks use dedicated worktrees when local execution is available.
- A writer task is not trusted as complete until branch/commit/PR evidence agrees with the repository state.
- `/pause`, `/resume`, and `/stop` semantics are respected at safe Agent-wave boundaries when executed by Luna runtime.

## Shared 꽃다발 authentication

Evidence Vault requires authentication and MUST use BloomBouquet shared **꽃다발 SSO**.

- Authorization Code + PKCE S256.
- The project never creates its own email/password credential store.
- Backend/BFF owns OAuth state and verifier until callback.
- Authorization code exchange and `/userinfo` occur server-side.
- Bouquet access token, code, verifier, and secrets never enter browser persistent storage, analytics, repository, logs, or user-visible error text.
- Evidence Vault creates its own server-owned session after verified userinfo.
- Every protected data query is scoped server-side to the authenticated Evidence Vault user.

## Product/legal guardrails

Evidence Vault organizes factual user-provided records. It does not provide individualized legal advice, legal representation, legal conclusions, or win/refund probability predictions.

- Deadlines are represented as user/source-recorded dates, not silently inferred legal entitlements.
- SHA-256 is described only as an integrity fingerprint, never proof of admissibility/authenticity/legal effect.
- Evidence is private by default.
- No permanent public object URLs.
- MVP does not intentionally support medical/health dispute evidence.
- High-risk identifiers should be redacted rather than intentionally collected.
- Account/case/file deletion must remove database state and stored objects according to the documented retention policy.

## Mandatory release governance

Verified product work flows through:

`Data & Marketing → Documentation → Code Review → Reviewer → QA`

Project-specific release planning also schedules both User Agents and the Process Evaluator after QA so real first-time/experienced-user findings are represented before release integration.

Data & Marketing owns `docs/marketing/MARKETING_ANALYSIS.md` and must distinguish observed facts, measured data, sourced evidence, inference, and experiment hypotheses. It must never fabricate market size, users, CTR, conversion, CAC, LTV, retention, growth, or competitor metrics.

Documentation independently verifies that analysis and owns `docs/marketing/GO_TO_MARKET.md` plus setup/run/build/test/deploy documentation.

## Failure routing

Blocked execution goes to the independent Debug / Problem Router Agent. Supported routes are:

1. retry the owning task when evidence supports a bounded retry,
2. escalate to PM replanning when the DAG/assumption is wrong,
3. request a Product Owner decision when the remaining choice is product-level, destructive, security-sensitive, or otherwise not safe to guess.

Never mark a blocked task successful to keep the DAG moving.

## Completion gate

The project is not complete merely because code renders. Release readiness requires, where applicable:

- complete primary workflow,
- persistent storage,
- 꽃다발 auth,
- loading/empty/invalid/error/permission/retry states,
- responsiveness and accessibility,
- private evidence storage and ownership boundaries,
- successful build and appropriate automated tests,
- browser/manual QA,
- verified documentation,
- Data & Marketing analysis plus Documentation-verified GTM,
- verified deployment/release path.

Unavailable production credentials, infrastructure, analytics, or providers remain explicit blockers; they are never replaced by fabricated success.