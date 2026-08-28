# Evidence Vault Dashboard and Vault UI Design

Date: 2026-08-28
Owner: Frontend Agent / Team 해바라기
Task: FE-001
Branch: `agent/해바라기/frontend/dashboard-vault-flow`
Depends on: DES-001, AUTHUI-001, BE-003, ONBUI-001

## Goal

Replace the authenticated handoff placeholder with the first real Evidence Vault product workspace:

- truthful owner-scoped dashboard,
- VaultItem creation,
- VaultItem detail/edit/archive,
- recorded Deadline management,
- complete loading/empty/error/destructive-confirmation states for this scope.

FE-001 must consume existing server authorization/domain contracts rather than creating a second client-side ownership model.

## Chosen architecture

Use **Server Component initial reads + small Client Component mutation islands**.

Initial page data is loaded on the server with the authenticated/onboarded user returned by ONBUI-001's product gate. Create/update/archive/deadline mutations call the existing authenticated JSON APIs and then refresh/navigate.

Rejected alternatives:

- client-only SPA fetching after paint — causes avoidable loading/auth flash and duplicates protected-session handling,
- Server Components fetching the app's own HTTP API — adds self-HTTP/cookie-forwarding complexity with no security benefit,
- putting all pages into one large client dashboard — weakens isolation/testability and makes protected data lifecycle harder to reason about,
- fake sample/KPI cards — prohibited by DES-001.

## Authorization boundary

Every evidence-bearing page consumes the server helper supplied by ONBUI-001, equivalent to:

```ts
const user = await requireProductUser();
```

This guarantees:

- valid Evidence Vault session,
- current onboarding completion,
- no raw `ev_session` token passed into client components.

Server reads receive `ownerUserId = user.id` only inside server code. Client forms never receive a trusted owner selector.

Mutation APIs independently resolve the owner again from the HttpOnly session. A client prop/user ID is never authoritative.

## Routes in FE-001

```text
/dashboard
/vault/new
/vault/[id]
```

No separate edit route is required in the MVP. Vault detail supports a deliberate edit mode within the page.

FE-001 does not implement `/case/*`, upload/download, or full Evidence Event timeline interactions; those remain BE-005/FE-002/FE-003 responsibilities.

## Dashboard

### Server read

`/dashboard` calls the existing owner-scoped dashboard projection directly on the server using the Seoul date boundary already defined by the backend contract.

The UI renders only data returned for the current user.

### Content order

1. `다가오는 기록 날짜`
2. `최근 기록`
3. `내 증빙함`

The Designer contract includes `분쟁 준비 중` when applicable, but FE-001 does not depend on BE-005. Therefore FE-001 **omits that section entirely** rather than rendering a fake/placeholder case count. FE-003 adds the real case section after BE-005 is integrated.

### Upcoming dates

Each row displays:

- neutral relative date text (`D-3`, `D-DAY`, `D+2`),
- source-labelled date name,
- related VaultItem title,
- merchant/service name only when present,
- actual date.

Wording must make provenance explicit. Use copy patterns such as:

- `반품 가능일로 기록한 날짜`,
- `직접 기록한 날짜`,
- `판매처 안내를 보고 기록한 날짜`,
- `일반 참고자료를 보고 기록한 날짜`.

Do not render `법정 기한`, `환불 마감`, `법적으로 보장` unless the underlying future feature has separately approved authoritative-source semantics.

Color/tone may reinforce urgency but text must remain meaningful without color.

### Recent events

Show factual event date, event title, and related VaultItem title. Do not rewrite notes or generate summaries.

FE-001 treats this as a dashboard read-only preview. Detailed timeline CRUD belongs to FE-002.

### Vault list

Each Vault card/list row includes:

- title,
- category label,
- merchant/service when present,
- purchase/start date,
- amount only when present,
- clear link to `/vault/[id]`.

Do not show evidence score/readiness/risk/probability.

### Empty dashboard

If `vaultItems` is empty:

- title: `아직 저장한 증빙함이 없어요.`,
- concise description covering supported purchase/subscription/rental/membership/used-goods/warranty/other non-medical contexts,
- primary action: `첫 증빙함 만들기` → `/vault/new`.

No fake records are inserted or displayed.

If there are VaultItems but no deadlines/events, those sections use compact honest empty states instead of hiding the entire dashboard.

### Dashboard failure

Server read failure renders a calm page-level Notice/recovery action without leaking stack/SQL/session details. The navigation shell may remain, but protected user data from a previous request/session must not be cached/rendered as fallback.

## VaultItem create page

`/vault/new` is a focused single-page form.

### Fields

Required:

- title,
- category,
- purchase/start date.

Optional:

- merchant/service name,
- amount KRW,
- factual description.

Category UI labels map to the existing backend enum:

- `online_purchase` → 온라인 구매,
- `subscription` → 구독,
- `rental` → 대여/렌탈,
- `membership` → 멤버십,
- `used_goods` → 중고거래,
- `warranty_service` → 보증/서비스,
- `other` → 기타.

Do not add a medical/health category.

### Amount handling

Present KRW amount as an integer-only optional input. Empty means absent; negative/decimal/non-numeric input is invalid. Avoid locale-formatted text being submitted without deterministic normalization.

### Save flow

Client submits to `POST /api/vault-items`.

- busy state disables duplicate submission and exposes textual saving status,
- `422 validation_failed` maps issues to the relevant field when path information exists,
- `401` uses existing session-required reauthentication behavior,
- `500/network` shows retryable neutral error,
- success uses the returned real item ID and navigates to `/vault/[id]`, then server data is read fresh.

Do not show success before the API returns persisted data.

### Unsaved changes

Warn on navigation only when the user has made meaningful changes from the initial empty form. Do not add a blanket browser prompt on untouched forms.

## Vault detail page

### Server read

`/vault/[id]` loads:

- owner-scoped VaultItem,
- owner-scoped Deadline list.

Cross-user/missing VaultItem renders the same `not found` surface. The UI must not distinguish another user's resource from a nonexistent one.

### Information hierarchy

1. title/context header,
2. core VaultItem facts,
3. `기록한 날짜`,
4. clear boundary where FE-002 will later provide the full evidence timeline/file workflow.

FE-001 must not render fake timeline entries or fake evidence counts while FE-002 is absent.

### Header/core facts

Show:

- title,
- category label,
- merchant/service when present,
- purchase/start date,
- amount when present,
- factual description when present,
- edit action,
- archive action.

Avoid a decorative hero/KPI treatment.

## Vault edit mode

Edit mode uses the same backend update contract and field semantics as create.

`PATCH /api/vault-items/[id]` sends only changed fields.

Rules:

- optional merchant/amount/description can be cleared using the backend nullable contract,
- category remains within existing enum,
- no owner/status fields are directly editable,
- successful save exits edit mode and refreshes server data,
- failed save preserves the user's unsaved edits and offers retry,
- validation errors remain associated with fields.

## Archive behavior

Archive is not hard deletion.

Flow:

1. user chooses `보관하기`,
2. show destructive/impact confirmation explaining the item will leave the active dashboard but this action is not the account/file destruction workflow,
3. confirm → `POST /api/vault-items/[id]/archive`,
4. success → navigate `/dashboard` and refresh,
5. `404` → not-found recovery,
6. failure → keep current page and show retryable error.

Copy must not say `영구 삭제` or `모든 증빙 삭제` for archive.

## Recorded Deadline UI

FE-001 owns the visible `기록한 날짜` CRUD because no later task owns Deadline interaction.

### List

Each row shows:

- date type label,
- actual date,
- relative date when useful,
- source type label,
- optional source note,
- edit/delete actions.

### Create/update fields

Consume backend Deadline enum values; user-facing labels must remain neutral. Required server fields are:

- type,
- due date,
- source type.

Source note is optional.

The UI must not auto-fill a legal deadline. Defaults may preselect a neutral custom/user-entered type only if the backend enum supports it; otherwise the user explicitly chooses.

### Delete

Deadline deletion removes only that recorded date. Confirmation copy must not imply related evidence/files are deleted.

### Mutation behavior

Use existing endpoints:

- `POST /api/vault-items/[id]/deadlines`,
- `PATCH /api/vault-items/[id]/deadlines/[deadlineId]`,
- `DELETE /api/vault-items/[id]/deadlines/[deadlineId]`.

After success, refresh server-rendered detail. Cross-user/missing nested resources stay normalized to not found.

## Loading and navigation behavior

Server-rendered initial reads reduce client loading states, but client transitions/mutations still need explicit state.

Use route-level `loading.tsx` where meaningful for dashboard/detail navigation and existing `LoadingState` primitives for client mutations.

Do not cache authenticated evidence data for cross-session reuse. Protected pages remain dynamic/no-store according to current server/auth behavior.

## Component boundaries

Prefer small focused units such as:

- dashboard section components,
- `VaultItemForm` reusable for create/edit,
- `VaultSummary`,
- `DeadlineList`,
- `DeadlineForm`,
- archive confirmation,
- field-error mapper for API validation issues.

Do not create one monolithic dashboard/client file containing fetch, forms, modals, formatting, and all sections.

Use existing design-system primitives (`Button`, field primitives, `Notice`, `DeadlineIndicator`, `EmptyState`, `LoadingState`, status primitives) before adding feature-specific styling.

## Accessibility contract

- one clear page `h1`, semantic section headings,
- visible form labels,
- hint/error associations preserved,
- field validation summary/focus behavior after failed submit,
- all menu/edit/archive/deadline controls keyboard operable,
- confirmation focus is trapped/restored appropriately if a modal/dialog is used,
- primary controls meet 44px target size,
- urgency is not color-only,
- loading/saving has text status,
- no horizontal scroll at 320px for core content/forms,
- long merchant/title/note text wraps,
- 200% zoom remains operable.

Automated style/component tests do not replace later real-browser QA.

## Error/not-found copy boundary

User-visible failures are local and calm:

- `저장하지 못했어요. 다시 시도해 주세요.`,
- `이 증빙함을 찾을 수 없어요.`,
- `기록한 날짜를 변경하지 못했어요.`.

Never render:

- SQL/database messages,
- raw API/provider bodies,
- session tokens,
- Bouquet values,
- other-user existence hints.

## Testing strategy

Implementation follows RED → observed RED → minimal GREEN → full GREEN.

Required automated coverage:

1. product pages require `requireProductUser`/equivalent completed-onboarding gate,
2. dashboard renders honest owner projection order,
3. dashboard full/section empty states,
4. no fake KPI/readiness/legal-risk/probability copy,
5. relative date text is deterministic for before/today/after,
6. category/source/date labels map from backend enums without changing stored values,
7. create form required/optional/amount validation,
8. create POST success navigates using returned real ID,
9. create/edit 422 issues bind to fields,
10. network/500/401 recovery states,
11. Vault detail same not-found behavior for missing/cross-user result,
12. edit PATCH sends only intended changed fields and supports clearing nullable fields,
13. archive requires confirmation and uses archive endpoint rather than delete,
14. Deadline create/update/delete use nested owner-scoped endpoints,
15. deadline copy never silently promotes a recorded date to a legal deadline,
16. no raw owner/session ID becomes a client authority,
17. responsive/style/accessibility component contracts,
18. complete unit suite and production build pass.

Later QA must still verify 320px, 200% zoom, keyboard-only operation, screen reader behavior, and deployed authenticated/onboarded data flow in a real browser.

## Explicit non-goals

- no onboarding implementation itself,
- no Evidence Event detail/timeline CRUD,
- no file upload/download/redaction UX,
- no case/export UI,
- no account deletion UI,
- no AI/OCR,
- no notification provider,
- no medical/health workflow,
- no fake case/dashboard analytics.

## Acceptance criteria

FE-001 is ready for integration when:

- authenticated + currently onboarded users see real owner-scoped dashboard data,
- empty users see an honest first-Vault CTA rather than samples,
- Vault create/detail/edit/archive works through existing server contracts,
- Deadline CRUD is available with source-neutral language,
- missing/cross-user resources share the same not-found UX,
- client code never becomes the ownership authority,
- existing design-system/accessibility contracts are preserved,
- full automated tests and production build are green,
- FE-002/FE-003 functionality is not faked or prematurely claimed.
