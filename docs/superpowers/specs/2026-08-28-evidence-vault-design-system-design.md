# Evidence Vault Design System — Design Spec

**Date:** 2026-08-28  
**Team:** 해바라기  
**Role owner:** Design System Agent  
**Repository:** `BloomBouquet/evidence-vault`  
**Branch:** `agent/해바라기/design-system/foundation`

## 1. Purpose

Evidence Vault needs a product-specific visual system before dashboard, authentication, timeline, evidence upload, case mode, export, and privacy flows expand the application.

The existing landing page already has a recognizable identity:

- warm paper background,
- dark ink text,
- restrained green accent,
- editorial serif display typography,
- document-like borders and spacing,
- low-decoration UI that fits a factual evidence product.

The design-system task should preserve that identity while turning it into reusable semantic tokens and accessible primitives. This task is not a visual rebrand.

## 2. Product principles the design must express

The interface should feel:

1. **Trustworthy** — factual, calm, and explicit rather than flashy.
2. **Private** — evidence and personal records should never feel public or social.
3. **Document-oriented** — timelines, dates, evidence, source labels, and exports are primary objects.
4. **Legally neutral** — visual urgency must not imply legal certainty or entitlement.
5. **Actionable** — users should quickly understand what needs attention next.
6. **Accessible** — keyboard, focus, text contrast, target size, and error states are first-class requirements.

## 3. Approaches considered

### Approach A — Preserve and systematize the current editorial-paper identity

Keep the existing paper/ink/green visual language, replace raw visual values with semantic tokens, and introduce a small set of reusable primitives.

**Advantages**

- preserves already-created product identity,
- low migration risk,
- visually compatible with evidence/document workflows,
- avoids generic SaaS dashboard styling,
- can grow into mobile and desktop layouts.

**Trade-offs**

- requires careful hierarchy so the interface does not become visually flat,
- serif display typography must remain limited to headings to protect readability.

### Approach B — Convert the product into a conventional SaaS dashboard system

Use neutral gray surfaces, rounded cards, standard sidebar navigation, and common dashboard components.

**Advantages**

- familiar implementation patterns,
- easy component-library mapping.

**Trade-offs**

- loses Evidence Vault's current identity,
- risks looking like a generic admin/finance dashboard,
- visually overstates metrics instead of records and evidence.

### Approach C — Ultra-minimal utility UI

Remove nearly all decorative identity and use monochrome controls, table-like layouts, and minimal spacing.

**Advantages**

- simple and efficient,
- strong information density.

**Trade-offs**

- can feel cold and institutional,
- weak first-time trust and onboarding experience,
- poor differentiation from ordinary file/document utilities.

## 4. Decision

Use **Approach A**.

The existing editorial-paper identity remains the source style, but all future screens use semantic tokens and reusable components rather than page-specific CSS values.

The design system must not introduce unsupported glow effects, glassmorphism, decorative gradients, neon accent colors, excessive rounded cards, fake dashboard metrics, or emoji-led UI.

## 5. Color system

The current palette is retained but renamed by semantic purpose.

### Base tokens

| Token | Initial value | Purpose |
|---|---:|---|
| `--color-bg-canvas` | `#f7f4ea` | application paper background |
| `--color-bg-surface` | `#fffdf7` | document/card/input surface |
| `--color-bg-subtle` | `#edf0e4` | quiet highlighted background |
| `--color-text-primary` | `#1c211c` | normal primary text |
| `--color-text-secondary` | `#686b64` | supporting text |
| `--color-border-default` | `#d9d5c9` | standard boundary |
| `--color-border-strong` | `#1c211c` | high-emphasis document boundary |
| `--color-brand` | `#244a34` | trusted green brand/action accent |
| `--color-accent-soft` | `#d9ef93` | selected/count/highlight accent |
| `--color-danger` | `#8f3a2e` | destructive/error text |
| `--color-danger-soft` | `#f1d3c8` | destructive/error background |

The implementation may adjust exact values only when contrast testing proves an accessibility issue. Semantic names are stable; raw values are not public component APIs.

### Status semantics

Status color alone must never carry meaning. Every status includes visible text and, when necessary, an icon or shape.

- `neutral`: ordinary record state.
- `info`: source/context information.
- `success`: completed/saved/verified application operation.
- `warning`: attention required, including an approaching user-recorded date.
- `danger`: destructive action, upload rejection, permission/security failure.

A deadline warning communicates proximity only. It must not visually claim that a legal deadline has been established by the service.

## 6. Typography

### Families

- Body/UI: `Pretendard`, `Noto Sans KR`, `Apple SD Gothic Neo`, system sans-serif fallback.
- Display heading: Georgia/serif fallback, used only for large marketing or section headings.
- Metadata/date/code-like labels: system monospace stack.

### Roles

- `display`: landing/major section statement only.
- `heading-lg`: page title.
- `heading-md`: section/card title.
- `body`: standard content.
- `body-sm`: secondary content.
- `label`: form/action label.
- `meta`: source labels, dates, evidence metadata, D-day values.

Body copy should default to Korean-friendly line height and `word-break: keep-all` where it improves readable sentence wrapping.

## 7. Spacing and layout

Use a 4px base rhythm with semantic spacing values:

`4 / 8 / 12 / 16 / 20 / 24 / 32 / 40 / 48 / 64 / 80 / 96`

Rules:

- normal control height: minimum 44px,
- icon-only target: minimum 44×44px,
- mobile page gutter: minimum 14px, preferred 16–20px,
- desktop content width: maximum around 1180px for marketing shell,
- operational content such as forms/timeline may use narrower readable widths,
- dense evidence metadata may use compact rows but never targets below accessibility minimums.

Breakpoints should be content-driven. Existing 850px and 520px rules may be retained initially, but components must not depend on device names.

## 8. Shape and depth

Evidence Vault should feel like documents and folders, not floating application cards.

- default radius: small or square (`0–6px`),
- pill shape reserved for statuses/tags where the shape communicates grouping,
- strong paper card may use a deliberate offset shadow such as the current deadline preview,
- repeated operational cards should not all use heavy shadows,
- borders are preferred over elevation for structure.

## 9. Core primitives

The implementation should create a deliberately small project-owned primitive layer.

### Button

Variants:

- `primary`
- `secondary`
- `ghost`
- `danger`

Sizes:

- `sm`
- `md`

Required behavior:

- keyboard focus-visible treatment,
- disabled state,
- pending/busy state with stable width where practical,
- no action conveyed by color alone,
- destructive variant uses explicit text.

### TextField

Required behavior:

- visible label,
- optional hint,
- error association using `aria-describedby`,
- invalid state using `aria-invalid`,
- disabled/read-only states visually distinct,
- no placeholder-only labels.

### TextArea

Same accessibility contract as TextField; used for factual notes and summaries.

### SelectField

Used for controlled domain values such as category/event/deadline source. Native select is preferred for MVP unless a custom interaction has a demonstrated product need.

### Notice

Variants:

- `info`
- `warning`
- `danger`
- `privacy`

Use cases:

- legal-neutral product disclaimer,
- privacy/redaction warning,
- upload failure,
- destructive deletion warning.

### StatusBadge

Use only for concise state labels such as `업로드 완료`, `삭제 대기`, or `내보내기 생성 중`.

The badge always includes text; color is secondary.

### DeadlineIndicator

Inputs:

- `daysRemaining`,
- user-facing source-labelled deadline text,
- urgency classification.

It may emphasize near dates but never removes wording such as `~로 기록한 날짜` or otherwise converts a recorded date into a legal determination.

### FieldGroup

Groups label, input, hint, error, and optional privacy/context note in a stable layout.

### EmptyState

Structure:

- clear title,
- one concise explanation,
- one primary next action,
- optional secondary help link.

Avoid decorative illustration requirements in MVP.

### LoadingState / Skeleton

Use only when the user would otherwise see layout shift or uncertainty. Auth/session checking must not briefly reveal protected content.

## 10. Product-specific patterns

### Evidence row

A file/evidence row should prioritize:

1. file/evidence title,
2. associated event/date,
3. file type and size,
4. integrity fingerprint availability,
5. redaction/export-inclusion state,
6. actions.

SHA-256 must be labelled as an integrity fingerprint/change-detection value, not as proof of legal authenticity or admissibility.

### Timeline event

Events use chronological structure rather than generic cards. Each event includes:

- recorded occurrence date,
- event type label,
- factual title,
- optional user note,
- evidence attachment count,
- record creation metadata only when useful.

### Deadline card/row

Hierarchy:

1. D-day/proximity,
2. Vault item title,
3. source-labelled deadline meaning,
4. date,
5. source/context note.

### Privacy-sensitive action

Uploads, export, and deletion should visually distinguish:

- saved vs local/not-yet-saved,
- private vs excluded-from-export,
- pending deletion vs deletion complete,
- recoverable retry vs irreversible action.

## 11. Focus and keyboard behavior

All interactive primitives must expose a visible focus indicator that is not removed by hover styling.

Minimum behavior:

- tab order follows visual reading order,
- Enter/Space semantics remain native for buttons/links,
- dialogs, if introduced later, require focus trapping and focus return,
- errors move focus only when doing so clearly improves task completion; otherwise the error summary/field relationship is enough,
- keyboard operation must cover auth actions, form submission, evidence actions, export selection, and account deletion.

## 12. Responsive behavior

### Mobile

Primary target is a single-column workflow.

- action groups may stack,
- data tables should become labelled rows rather than horizontal overflow when practical,
- essential date/status metadata remains visible,
- long Korean titles wrap without clipping,
- fixed bottom actions are allowed only when they do not cover content/focus targets.

### Desktop

Desktop may introduce split views for navigation/detail or timeline/evidence context, but the MVP system does not require a persistent sidebar component.

The design system should not force application architecture before Designer Agent defines full page flows.

## 13. Accessibility acceptance criteria

Before DS-001 is considered implemented:

- text/background combinations used by primitives meet WCAG AA contrast for their role,
- interactive focus is clearly visible,
- form errors are programmatically associated,
- status/error meaning is not color-only,
- interactive targets are at least 44×44px where applicable,
- components work at 320px viewport width without horizontal page overflow,
- 200% browser zoom remains operable,
- reduced-motion preference is respected if motion is introduced,
- loading states do not expose protected content before auth state is resolved.

## 14. Proposed implementation boundaries

The later implementation plan should use focused files rather than expanding `app/globals.css` indefinitely.

Expected structure:

```text
src/components/ui/
  button.tsx
  field-group.tsx
  text-field.tsx
  text-area.tsx
  select-field.tsx
  notice.tsx
  status-badge.tsx
  deadline-indicator.tsx
  empty-state.tsx

src/styles/
  tokens.css
  primitives.css
```

`app/globals.css` remains responsible for reset/base document rules and imports the project style layers.

The exact file set is finalized in the implementation plan after this spec is approved.

## 15. Testing strategy

Component tests should cover behavior, accessibility contract, and semantic output rather than snapshotting implementation markup.

Expected checks:

- Button renders correct native semantics, disabled and busy states.
- TextField associates label/hint/error IDs and `aria-invalid` correctly.
- Notice exposes readable content for every variant without relying on color.
- DeadlineIndicator preserves recorded-date wording.
- EmptyState exposes one clear primary action.
- keyboard focus styles are present through classes/tokens and manual browser verification.

Production build remains a required PR gate.

## 16. Non-goals

DS-001 does not design or implement:

- complete dashboard navigation,
- full authentication pages,
- timeline page composition,
- evidence uploader behavior,
- case/export flow,
- modal/dialog framework unless another approved flow requires it,
- dark mode,
- custom icon library,
- animation framework,
- charts/KPI dashboard,
- third-party UI component library adoption.

Those choices remain owned by later Designer/Frontend tasks.

## 17. Handoff to Designer Agent

After DS-001 is approved and implemented, Designer Agent receives:

- semantic color/type/spacing contracts,
- reusable control/state primitives,
- product-specific deadline/privacy/evidence patterns,
- accessibility constraints,
- unchanged legal-neutrality requirements.

Designer Agent remains free to challenge composition/layout choices, but should not casually bypass semantic tokens or accessibility contracts without documenting why.

## 18. Approval decision

Recommended decision: **APPROVE Approach A — preserve and systematize the editorial-paper identity.**

This keeps Evidence Vault visually distinct while providing enough structure for the upcoming auth, dashboard, evidence, case/export, and privacy workflows without prematurely building a large generic component library.
