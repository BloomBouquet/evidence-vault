# Evidence Vault Core Flows Design

Date: 2026-08-28
Owner: Designer Agent / Team 해바라기
Task: DES-001
Branch: `agent/해바라기/designer/core-flows`
Depends on: IDEA-001, DS-001

## Goal

Define the primary Evidence Vault user journeys and screen-state contracts before Frontend implementation begins. The product must feel like a calm, private evidence workspace rather than a generic admin dashboard or legal-advice product.

## Product stance

Evidence Vault organizes user-provided facts, recorded dates, and attachments. It does not determine legal rights, legal deadlines, admissibility, liability, refund eligibility, or success probability.

The UI therefore prioritizes:

1. what the user recorded,
2. what happened and when,
3. what evidence is already saved,
4. what evidence the user may still want to add,
5. what the user can do next.

The UI must never imply that a recorded date is automatically a legal deadline.

## Chosen navigation model

Use a **document-first hub** model.

Global navigation remains intentionally small:

- 증빙함
- 분쟁 준비
- 가이드
- 계정

Desktop uses a compact top header. Mobile uses a compact menu. Persistent left-side navigation and bottom-tab navigation are intentionally excluded from MVP because they would make the product feel like a general-purpose administration console while the navigation depth is still small.

Primary actions appear in the current document or case context instead of being duplicated globally.

## Primary route model

```text
/
↓
꽃다발 로그인
↓
/onboarding   (first authenticated visit only)
↓
/dashboard
├─ /vault/new
├─ /vault/[id]
│  ├─ dates
│  ├─ timeline
│  ├─ attachments
│  └─ start case preparation
├─ /case/[id]
│  ├─ evidence checklist
│  ├─ factual summary
│  └─ export review
├─ /guide
└─ /account

/case/[id]/export
```

`/guide` is a factual official-source guide surface. It does not provide individualized legal advice and each substantive guide item must carry its source and verification date when implemented.

The exact App Router grouping may change during implementation, but the user-visible route responsibilities and transitions in this document are the product contract.

## Flow 1 — Landing to authenticated product

### Anonymous landing

The landing page explains three things before login:

- save evidence before a dispute becomes difficult to reconstruct,
- record important dates with their source/context,
- prepare a factual packet without legal judgment.

Primary action: `꽃다발로 시작하기`.

Evidence Vault never renders email/password inputs. Login always enters the server-owned 꽃다발 SSO flow.

### Auth transition states

The product must distinguish:

- checking session,
- anonymous,
- redirecting to 꽃다발,
- callback processing,
- authenticated,
- authentication error.

Protected product content must not flash before the initial application-session check completes.

### Authentication error

Show a neutral error such as `로그인을 완료하지 못했어요.` with:

- retry login action,
- return to landing action.

Do not expose authorization code, PKCE verifier, access token, provider stack trace, account-existence hints, or raw provider response text.

## Flow 2 — First authenticated visit / onboarding

Onboarding is a short safety/privacy gate, not a marketing profile wizard.

Required confirmations:

- user confirms age 14 or older,
- Terms acceptance,
- Privacy Policy acceptance.

Explain before completion:

- evidence is private by default,
- unnecessary high-risk identifiers should be redacted,
- Evidence Vault does not provide legal advice or representation.

Do not ask for demographic data, dispute category preferences, phone number, address, or other profile information that is not required by the product.

### Onboarding states

- loading current acceptance state,
- ready,
- validation error,
- save in progress,
- save failure with retry,
- completed.

The user cannot reach protected evidence workflows until required onboarding acknowledgements are recorded.

## Flow 3 — Dashboard

The dashboard is a work queue, not a KPI page.

Order of content:

1. **다가오는 기록 날짜**
2. **최근 기록**
3. **내 증빙함**
4. **분쟁 준비 중** when applicable

Do not show fake analytics such as evidence scores, readiness percentages, legal-risk percentages, refund probability, win probability, or generic KPI cards.

### Upcoming dates

Each item displays:

- relative date such as `D-3`, `D-DAY`, or `D+2`,
- the source-labelled date name, for example `반품 가능일로 기록한 날짜`,
- related VaultItem title,
- optional merchant/service name.

The UI may use a caller-supplied neutral/warning/danger visual tone, but text must remain meaningful without color.

### Dashboard empty state

When no VaultItem exists:

Title: `아직 저장한 증빙함이 없어요.`

Description: explain that the first item can represent a purchase, subscription, rental, membership, warranty/service record, used-goods transaction, or other supported non-medical context.

Primary action: `첫 증빙함 만들기`.

No fake sample records are rendered as if they belonged to the user.

### Dashboard failure state

Show a compact retryable Notice. Preserve any already-rendered safe navigation shell; do not display stale protected data from another session.

## Flow 4 — Create VaultItem

The create flow is a focused single-page form rather than a multi-step wizard.

Required fields:

- title,
- category,
- purchase/start date.

Optional fields:

- merchant/service name,
- amount in KRW,
- factual description.

Supported categories remain aligned with the domain contract and intentionally exclude medical/health dispute workflows in MVP.

### Form behavior

- Every field has a visible label.
- Validation is shown next to the relevant control.
- Amount must not accept negative values.
- Save is not shown as complete before server persistence succeeds.
- Leaving with unsaved edits should use a conventional unsaved-changes warning only when meaningful changes exist.

### Save success

Redirect to `/vault/[id]` and present the created record, not a celebratory interstitial.

## Flow 5 — Vault detail

A Vault detail is the primary factual record workspace.

Information hierarchy:

1. title and current context,
2. recorded dates,
3. chronological evidence timeline,
4. saved attachments,
5. case-preparation entry point.

### Header

Show:

- title,
- category,
- merchant/service when present,
- purchase/start date,
- edit/archive actions.

Avoid large decorative hero cards.

### Recorded dates

Dates are grouped under `기록한 날짜`.

Every date row includes:

- source-labelled date type,
- actual date,
- relative value when useful,
- source type such as user-entered / merchant-provided / general reference,
- optional source note.

General-reference dates must not be presented as if a merchant or law guaranteed them.

### Evidence timeline

Timeline events are chronological factual entries. Examples:

- 구매함,
- 배송받음,
- 문제 발견,
- 환불 요청,
- 판매자 답변,
- 결제함,
- 계약함,
- custom event.

Each event can include date, title, factual note, and attachments.

The UI does not rewrite user facts into legal conclusions.

### Timeline empty state

Explain that events create the factual chronology that can later be exported. Primary action: `첫 기록 추가하기`.

## Flow 6 — Evidence attachment

Attachment upload is initiated from a VaultItem or timeline event.

Before upload, show concise privacy guidance:

- 주민등록번호 등 불필요한 고위험 식별정보는 가리기,
- 관계없는 제3자 개인정보는 제외하거나 가리기,
- MVP supports PDF/JPEG/PNG/WEBP,
- maximum 20 MiB per file.

### Redaction behavior

For images, later implementation may provide client-side permanent rasterized redaction before upload.

For PDFs in MVP, the product must instruct the user to upload a pre-redacted PDF rather than implying that the product securely redacts PDF internals.

### Upload states

- selected locally,
- validating,
- uploading,
- persisted successfully,
- rejected because unsupported,
- rejected because oversized,
- permission/session failure,
- server/storage failure with retry.

A file must not appear in the permanent saved list until server persistence succeeds.

### Download

Download action requests an authenticated short-lived URL from the server. The UI must not display or expose a permanent public object URL.

## Flow 7 — Case preparation

The user may create a case-preparation workspace from a VaultItem.

The feature is named and written as preparation/organization, not legal assessment.

### Case landing

Show:

- case type,
- user-written summary,
- linked evidence,
- evidence checklist,
- factual chronology preview,
- export action.

### Neutral checklist

Checklist language describes materials that may help the user organize the record, for example:

- 거래 사실을 보여주는 자료,
- 상대방과 주고받은 내용,
- 문제 상태를 보여주는 사진/문서,
- 환불/해지 요청 기록.

Do not use wording like `법적으로 반드시 필요`, `이 자료가 있으면 승소`, `환불받을 수 있음`, or `법적 효력이 있음` unless a later feature cites a specific authoritative source and the product/legal scope is separately approved.

### Missing evidence

Missing checklist items are shown as organizational gaps, not legal deficiencies.

Use copy such as `아직 연결하지 않은 자료가 있어요.` instead of `증거가 부족합니다.`

## Flow 8 — Export review

Export is a review step before packet generation.

The screen shows:

- factual summary preview,
- included chronology,
- included attachment names,
- exclude/include controls,
- reminder to review unnecessary personal data,
- legal-disclaimer text.

Generated packet contract remains:

```text
summary.pdf
manifest.json
evidence/*
```

The export screen never claims authenticity, admissibility, legal effect, or completeness.

### Export states

- ready to generate,
- generating,
- generated/ready,
- failed with retry,
- expired/deleted.

Download requires the authenticated owner and uses short-lived access.

## Flow 9 — Account and privacy

Account surface contains only product-relevant controls:

- display name/session identity summary,
- Terms/Privacy acknowledgement status,
- sign out,
- delete account/data.

Do not expose central 꽃다발 password-management UI inside Evidence Vault.

### Sign out

Sign out invalidates the Evidence Vault application session and returns the user to an anonymous product state. It does not sign the user out of the central 꽃다발 SSO service.

### Delete account/data

Deletion requires a clear destructive confirmation that explains:

- app access is denied immediately after deletion begins,
- stored evidence files may be removed asynchronously through deletion reconciliation,
- a retry/failure state may remain while storage deletion is being reconciled,
- completion is not claimed until the documented deletion workflow is complete.

Do not display an instant `모든 데이터가 삭제되었습니다` success message before backend deletion status actually confirms completion.

## Global state contract

Every primary product surface must deliberately handle applicable states from this list:

- loading,
- empty,
- invalid input,
- save in progress,
- save failure,
- permission/authentication failure,
- retry,
- not found,
- destructive action confirmation,
- completed action.

Unknown failures use calm neutral copy and a retry/recovery path. Sensitive provider/storage error internals are not rendered to users.

## Responsive behavior

### 320px width

- no horizontal scrolling for core text/forms,
- primary action can expand full-width,
- timeline and deadline rows stack when needed,
- attachment filenames wrap rather than overflow,
- tables are avoided for primary mobile workflows.

### Desktop

Content remains reading-width oriented. Wide screens do not stretch forms and chronology text across the entire viewport.

## Accessibility contract

- semantic headings follow the document hierarchy,
- all interactive controls are keyboard operable,
- visible labels are used for form fields,
- error/hint text is programmatically associated,
- focus indicators remain visible,
- minimum interactive target height is 44px for primary controls/actions,
- status is not communicated by color alone,
- loading uses textual status and respects reduced-motion preferences,
- focus must move deliberately after destructive modal/confirmation completion or route-level validation errors when required by the composed interaction.

Automated primitive tests do not replace browser-level keyboard, 200% zoom, screen-reader, and 320px QA of composed screens.

## Explicit non-goals for DES-001

- no production page implementation,
- no new backend API contract beyond referencing already-planned responsibilities,
- no OCR,
- no AI legal analysis,
- no chatbot,
- no payments,
- no notification provider integration,
- no permanent public sharing links,
- no medical/health dispute workflow,
- no fake analytics dashboard.

## Acceptance criteria

DES-001 is complete when this spec gives Frontend/Backend Agents an unambiguous interaction contract for:

- landing/login transition,
- onboarding,
- dashboard,
- VaultItem create/detail,
- recorded dates,
- evidence timeline/upload/download,
- case preparation,
- export review,
- account/sign-out/deletion,
- factual official-source guide navigation,
- loading/empty/error/permission/retry states,
- mobile/keyboard/accessibility constraints,
- legal/privacy-neutral wording boundaries.
