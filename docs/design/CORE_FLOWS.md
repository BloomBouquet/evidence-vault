# Evidence Vault Core Flows

Canonical detailed design: `docs/superpowers/specs/2026-08-28-evidence-vault-core-flows-design.md`

## Navigation

Evidence Vault uses a document-first hub with a compact top-level navigation surface:

- 증빙함
- 분쟁 준비
- 가이드
- 계정

Primary product flow:

```text
/ → 꽃다발 로그인 → /onboarding → /dashboard
/dashboard → /vault/new → /vault/[id]
/vault/[id] → evidence timeline / attachments / case preparation
/case/[id] → checklist / factual summary / export review
/case/[id]/export → private export packet
```

`/guide` is factual official-source guidance only and requires source + verification date for substantive content.

## Product interaction rules

- Do not render project-owned email/password forms.
- Dashboard is a work queue, not a KPI dashboard.
- Recorded dates must remain source-labelled and must not be presented as automatically legal deadlines.
- Evidence timeline records user facts and attachments without rewriting them into legal conclusions.
- Upload UI must warn about unnecessary high-risk identifiers and unrelated third-party personal data.
- PDF redaction is not claimed in MVP; users must upload a pre-redacted PDF.
- Case preparation uses neutral organizational language, not legal sufficiency or win/refund predictions.
- Export requires review of included evidence and private data before generation.
- Account deletion does not claim completion until backend deletion reconciliation actually completes.

## Required states

Every applicable primary surface must deliberately handle loading, empty, invalid, saving, save failure, authentication/permission failure, retry, not found, destructive confirmation, and completed-action states.

## Accessibility/responsive gates

- 320px: no horizontal scrolling for core forms/content.
- Visible field labels and associated hint/error text.
- Keyboard-operable controls with visible focus.
- Primary interactive target height at least 44px.
- Status meaning is not color-only.
- Full composed-screen keyboard/zoom/screen-reader behavior remains a later browser QA gate.