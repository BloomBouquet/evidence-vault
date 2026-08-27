# Evidence Vault Design System — Design Spec

**Date:** 2026-08-28  
**Team:** 해바라기  
**Role owner:** Design System Agent  
**Repository:** `BloomBouquet/evidence-vault`  
**Branch:** `agent/해바라기/design-system/foundation`

## 1. Purpose

Evidence Vault needs a product-specific visual system before dashboard, authentication, timeline, evidence upload, case mode, export, and privacy flows expand the application.

The existing landing page already has a recognizable identity: warm paper background, dark ink text, restrained green accent, editorial serif display typography, document-like borders, and low-decoration UI that fits a factual evidence product.

DS-001 preserves that identity while turning it into reusable semantic tokens and accessible primitives. This task is not a visual rebrand.

## 2. Product principles

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

Advantages: preserves product identity, has low migration risk, fits evidence/document workflows, avoids generic SaaS styling, and scales to mobile/desktop.

Trade-off: hierarchy must be deliberate so the interface does not become visually flat; serif display typography must remain limited to headings.

### Approach B — Conventional SaaS dashboard system

Use neutral gray surfaces, rounded cards, standard sidebar navigation, and common dashboard components.

Advantage: familiar implementation patterns.  
Trade-off: loses the current identity, risks a generic admin/finance look, and over-emphasizes metrics rather than records.

### Approach C — Ultra-minimal utility UI

Use monochrome controls, table-like layouts, and very little decorative identity.

Advantage: efficient information density.  
Trade-off: can feel cold/institutional and weakens first-time trust and differentiation.

## 4. Decision

Use **Approach A**.

The editorial-paper identity remains the source style, but future screens use semantic tokens and reusable components rather than page-specific raw CSS values.

The system must not introduce unsupported glow effects, glassmorphism, decorative gradients, neon accent colors, excessive rounded cards, fake dashboard metrics, or emoji-led UI.

## 5. Color system

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
| `--color-info` | `#3f5661` | informational text/accent |
| `--color-info-soft` | `#e7edef` | informational surface |
| `--color-success` | `#244a34` | successful application operation |
| `--color-success-soft` | `#edf0e4` | success surface |
| `--color-warning` | `#6f5414` | attention-required text/accent |
| `--color-warning-soft` | `#f3e5ad` | attention surface |
| `--color-danger` | `#8f3a2e` | destructive/error text |
| `--color-danger-soft` | `#f1d3c8` | destructive/error surface |

These are initial values, not immutable brand constants. Implementation must contrast-test the actual text/background combinations and may adjust raw values while preserving semantic token names.

### Status semantics

Status color alone never carries meaning. Every status has visible text and, where useful, an icon or shape.

- `neutral`: ordinary record state.
- `info`: source/context information.
- `success`: completed/saved application operation.
- `warning`: user attention required.
- `danger`: destructive action, upload rejection, permission/security failure.

A deadline warning communicates proximity only. It never claims the service established a legal deadline.

## 6. Typography

Families:

- Body/UI: `Pretendard`, `Noto Sans KR`, `Apple SD Gothic Neo`, system sans-serif fallback.
- Display: Georgia/serif fallback, limited to large marketing or section headings.
- Metadata/date/code-like labels: system monospace stack.

Roles:

- `display`
- `heading-lg`
- `heading-md`
- `body`
- `body-sm`
- `label`
- `meta`

Body copy uses Korean-friendly line height and `word-break: keep-all` where it improves sentence wrapping.

## 7. Spacing and layout

Use a 4px base rhythm with semantic values:

`4 / 8 / 12 / 16 / 20 / 24 / 32 / 40 / 48 / 64 / 80 / 96`

Rules:

- normal controls: minimum 44px high,
- icon-only target: minimum 44×44px,
- mobile page gutter: minimum 14px, preferred 16–20px,
- marketing content width: maximum around 1180px,
- operational forms/timelines may use narrower readable widths,
- compact evidence metadata must not reduce interactive targets below the accessibility minimum.

Breakpoints are content-driven. Existing 850px and 520px rules may remain initially, but components must not depend on device names.

## 8. Shape and depth

Evidence Vault should feel like documents and folders, not floating SaaS cards.

- default radius: small or square (`0–6px`),
- pills reserved for status/tag grouping,
- one strong paper card may use a deliberate offset shadow like the current deadline preview,
- repeated operational cards should not all use heavy elevation,
- borders are preferred over shadows for structure.

## 9. Core primitives

### Button

Variants: `primary`, `secondary`, `ghost`, `danger`.  
Sizes: `sm`, `md`.

Required behavior: native button/link semantics, visible focus, disabled state, pending/busy state, stable width where practical, and explicit destructive text.

### FieldGroup

Owns the stable relationship among label, input, hint, error, and optional privacy/context note.

### TextField

Requires a visible label, optional hint, `aria-describedby` linkage, `aria-invalid`, and distinct disabled/read-only presentation. Placeholder-only labels are prohibited.

### TextArea

Uses the same accessibility contract as TextField and is intended for factual notes/summaries.

### SelectField

Used for controlled domain values. Native `<select>` is preferred for MVP unless a later approved flow demonstrates a need for custom interaction.

### Notice

Variants: `info`, `warning`, `danger`, `privacy`.

Use cases include legal-neutral product disclaimer, privacy/redaction warning, upload failure, and destructive deletion warning.

### StatusBadge

Used only for concise state labels such as `업로드 완료`, `삭제 대기`, or `내보내기 생성 중`. Text is mandatory; color is secondary.

### DeadlineIndicator

Inputs:

- `daysRemaining: number`,
- `label: string` containing the source-labelled/user-recorded meaning,
- `tone: "neutral" | "warning" | "danger"` supplied by product/domain presentation logic.

The design system does **not** define date thresholds and does not infer legal urgency. It only renders the supplied tone and must preserve wording such as `~로 기록한 날짜`.

### EmptyState

Contains a clear title, one concise explanation, one primary next action, and an optional secondary help link. No decorative illustration is required for MVP.

### LoadingState

Provides stable layout feedback for session checks or data loading. It must never reveal protected content while auth state is unresolved. Skeleton styling is allowed only where it improves spatial stability.

## 10. Product-specific patterns

### Evidence row

Priority:

1. file/evidence title,
2. associated event/date,
3. file type and size,
4. integrity fingerprint availability,
5. redaction/export-inclusion state,
6. actions.

SHA-256 is labelled as an integrity/change-detection fingerprint, never proof of legal authenticity or admissibility.

### Timeline event

Uses chronological structure rather than generic cards. It includes occurrence date, event type label, factual title, optional user note, attachment count, and record metadata only when useful.

### Deadline card/row

Hierarchy:

1. proximity/D-day,
2. Vault item title,
3. source-labelled deadline meaning,
4. date,
5. source/context note.

### Privacy-sensitive action

Uploads, export, and deletion must visibly distinguish:

- saved vs local/not-yet-saved,
- private vs excluded-from-export,
- pending deletion vs deletion complete,
- recoverable retry vs irreversible action.

## 11. Focus and keyboard behavior

All interactive primitives expose a visible `:focus-visible` state that is not removed by hover styling.

- tab order follows reading order,
- Enter/Space native semantics remain intact,
- later dialogs require focus trap and focus return,
- errors move focus only when it materially improves completion,
- keyboard operation must eventually cover auth, forms, evidence actions, export selection, and account deletion.

## 12. Responsive behavior

### Mobile

Primary model is a single-column workflow.

- action groups may stack,
- data tables should become labelled rows when practical rather than force horizontal overflow,
- essential date/status metadata remains visible,
- long Korean titles wrap without clipping,
- fixed bottom actions are permitted only when they do not cover content or focus targets.

### Desktop

Desktop may later use split views for navigation/detail or timeline/evidence context, but DS-001 does not require a persistent sidebar.

The design system must not force page architecture before Designer Agent defines full flows.

## 13. Accessibility acceptance criteria

Before DS-001 implementation is accepted:

- primitive text/background combinations meet WCAG AA contrast for their role,
- focus is clearly visible,
- form errors are programmatically associated,
- status/error meaning is not color-only,
- interactive targets are at least 44×44px where applicable,
- components operate at 320px viewport width without page-level horizontal overflow,
- 200% browser zoom remains operable,
- reduced-motion preference is respected if motion is introduced,
- loading/auth checking never flashes protected content.

## 14. Implementation boundary

The later implementation plan should use focused files instead of continuing to expand `app/globals.css`.

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
  loading-state.tsx

src/styles/
  tokens.css
  primitives.css
```

`app/globals.css` remains responsible for reset/base document rules and imports the style layers. The implementation plan may split component-specific CSS further if tests/maintainability justify it, but it must name the exact files before code begins.

## 15. Testing strategy

Component tests focus on behavior and accessibility rather than markup snapshots.

Required coverage:

- Button native semantics, disabled, and busy states.
- Field/TextField label-hint-error relationships and `aria-invalid`.
- Notice readable content for every variant without color-only meaning.
- StatusBadge visible text semantics.
- DeadlineIndicator preserves caller-provided recorded-date wording and has no built-in legal/date threshold logic.
- EmptyState exposes one clear primary action.
- LoadingState hides protected content while unresolved.
- manual browser verification confirms focus visibility, 320px operation, 200% zoom, and contrast values.
- production build remains a PR gate.

## 16. Non-goals

DS-001 does not design or implement:

- complete dashboard navigation,
- full authentication pages,
- timeline page composition,
- evidence uploader behavior,
- case/export workflow,
- dialog framework unless a later approved flow requires it,
- dark mode,
- custom icon library,
- animation framework,
- charts/KPI dashboard,
- third-party UI component library adoption.

Those choices remain owned by later Designer/Frontend tasks.

## 17. Handoff to Designer Agent

After DS-001 is approved and implemented, Designer Agent receives semantic color/type/spacing contracts, reusable controls/states, deadline/privacy/evidence patterns, accessibility constraints, and unchanged legal-neutrality requirements.

Designer Agent may challenge composition/layout choices, but should not bypass semantic tokens or accessibility contracts without documenting evidence and rationale.

## 18. Approval decision

Recommended decision: **APPROVE Approach A — preserve and systematize the editorial-paper identity.**

This keeps Evidence Vault visually distinct while providing enough structure for upcoming auth, dashboard, evidence, case/export, and privacy workflows without prematurely building a large generic component library.
