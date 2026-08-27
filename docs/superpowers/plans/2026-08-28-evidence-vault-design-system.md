# Evidence Vault Design System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn Evidence Vault's existing editorial-paper visual language into a small, accessible, product-owned design system for future auth, dashboard, evidence, case/export, and privacy flows.

**Architecture:** Keep `app/globals.css` as the document/reset layer and import two focused style layers: semantic tokens and reusable primitive classes. Build server-compatible React primitives without a third-party UI library; inputs require explicit IDs so accessible hint/error relationships do not depend on client hooks. Deadline presentation receives a caller-supplied urgency tone and never calculates legal meaning.

**Tech Stack:** Next.js 16, React 19, TypeScript, CSS custom properties, Vitest, Testing Library, jest-dom.

**Spec:** `docs/superpowers/specs/2026-08-28-evidence-vault-design-system-design.md`

## Global Constraints

- Preserve the existing warm paper / dark ink / restrained green editorial identity; this is not a rebrand.
- Do not add a third-party UI component library.
- Do not add glow, glassmorphism, decorative gradients, neon accents, excessive rounded cards, fake KPI dashboards, or emoji-led UI.
- Status/error meaning must never rely on color alone.
- Interactive controls use a minimum 44px target height where applicable.
- Form fields use visible labels; placeholder-only labels are forbidden.
- Form errors are connected with `aria-invalid` and `aria-describedby`.
- Focus-visible treatment is required for links, buttons, inputs, textareas, and selects.
- `DeadlineIndicator` receives `tone: "neutral" | "warning" | "danger"`; it never decides urgency thresholds or legal deadlines itself.
- Deadline copy remains caller-supplied source-labelled wording such as `반품 가능일로 기록한 날짜`.
- SHA-256 remains an integrity fingerprint only; no component copy may imply legal authenticity/admissibility.
- MVP remains light-mode only.
- 320px viewport and 200% zoom must remain operable without horizontal page overflow from the primitive layer.
- Production implementation follows RED → verify RED → minimal GREEN → verify GREEN → refactor.

---

## File Map

| Path | Responsibility |
|---|---|
| `src/styles/tokens.css` | semantic color, spacing, radius, typography, focus tokens |
| `src/styles/primitives.css` | reusable control/state component classes only |
| `app/globals.css` | reset/base/landing composition; imports design-system style layers |
| `src/components/ui/button.tsx` | semantic native button variants/sizes/busy state |
| `src/components/ui/field-group.tsx` | shared label/hint/error structure and ID contract |
| `src/components/ui/text-field.tsx` | accessible native input |
| `src/components/ui/text-area.tsx` | accessible native textarea |
| `src/components/ui/select-field.tsx` | accessible native select with explicit options |
| `src/components/ui/notice.tsx` | info/warning/danger/privacy notice |
| `src/components/ui/status-badge.tsx` | concise visible-text status label |
| `src/components/ui/deadline-indicator.tsx` | caller-toned D-day + source-labelled text |
| `src/components/ui/empty-state.tsx` | single-next-action empty state |
| `src/components/ui/loading-state.tsx` | non-leaking busy/status placeholder |
| `src/components/ui/button.test.tsx` | button behavior/accessibility tests |
| `src/components/ui/fields.test.tsx` | field label/hint/error/disabled/read-only tests |
| `src/components/ui/statuses.test.tsx` | notice/status/deadline semantics tests |
| `src/components/ui/states.test.tsx` | empty/loading state tests |

---

### Task 1: Semantic tokens and base style layers

**Files:**
- Create: `src/styles/tokens.css`
- Create: `src/styles/primitives.css`
- Modify: `app/globals.css`

**Interfaces:**
- Consumes: existing raw landing colors in `app/globals.css`.
- Produces: stable CSS variables `--color-*`, `--space-*`, `--radius-*`, `--control-height-*`, `--focus-ring`; primitive class namespace `.ev-*` used by Tasks 2-5.

- [ ] **Step 1: Write the style-contract failing test**

Create `src/components/ui/style-contract.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const tokens = readFileSync("src/styles/tokens.css", "utf8");
const primitives = readFileSync("src/styles/primitives.css", "utf8");

describe("design system style contract", () => {
  it("defines semantic product and accessibility tokens", () => {
    for (const token of [
      "--color-bg-canvas",
      "--color-text-primary",
      "--color-brand",
      "--color-info",
      "--color-success",
      "--color-warning",
      "--color-danger",
      "--control-height-md",
      "--focus-ring",
    ]) expect(tokens).toContain(token);
  });

  it("defines reusable primitive classes", () => {
    for (const className of [".ev-button", ".ev-field", ".ev-notice", ".ev-badge", ".ev-deadline", ".ev-empty", ".ev-loading"])
      expect(primitives).toContain(className);
  });
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `pnpm vitest run src/components/ui/style-contract.test.ts`

Expected: FAIL because `src/styles/tokens.css` / `primitives.css` do not exist.

- [ ] **Step 3: Implement semantic tokens**

`src/styles/tokens.css` defines the exact approved base palette plus `info/success/warning/danger` soft surfaces, spacing values `4..96`, `--radius-sm: 4px`, `--radius-md: 6px`, `--control-height-sm: 44px`, `--control-height-md: 48px`, and `--focus-ring: 0 0 0 3px rgba(36, 74, 52, .28)`.

- [ ] **Step 4: Implement primitive CSS contract**

`src/styles/primitives.css` provides `.ev-button`, `.ev-field`, `.ev-notice`, `.ev-badge`, `.ev-deadline`, `.ev-empty`, `.ev-loading`, shared `:focus-visible`, disabled/busy, error, read-only, and 320px-safe wrapping rules. Do not add page layout.

- [ ] **Step 5: Import style layers and map legacy variables**

At the top of `app/globals.css`:

```css
@import "tailwindcss";
@import "../src/styles/tokens.css";
@import "../src/styles/primitives.css";
```

Keep temporary aliases so existing landing CSS remains unchanged during DS-001:

```css
:root {
  --paper: var(--color-bg-canvas);
  --ink: var(--color-text-primary);
  --muted: var(--color-text-secondary);
  --line: var(--color-border-default);
  --green: var(--color-brand);
  --lime: var(--color-accent-soft);
  --card: var(--color-bg-surface);
  --danger: var(--color-danger);
}
```

- [ ] **Step 6: Run focused test and full suite**

Run:

```bash
pnpm vitest run src/components/ui/style-contract.test.ts
pnpm test:run
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add app/globals.css src/styles src/components/ui/style-contract.test.ts
git commit -m "feat: add design system style tokens"
```

---

### Task 2: Button primitive

**Files:**
- Create: `src/components/ui/button.tsx`
- Create: `src/components/ui/button.test.tsx`

**Interfaces:**
- Produces:

```ts
export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md";
export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  busy?: boolean;
};
export function Button(props: ButtonProps): React.ReactElement;
```

- [ ] **Step 1: Write failing tests**

Tests verify default `type="button"`, native button role, variant/size classes, disabled behavior, `busy` sets `aria-busy="true"` and disables activation, and custom `className` is preserved.

- [ ] **Step 2: Run RED**

Run: `pnpm vitest run src/components/ui/button.test.tsx`

Expected: FAIL because `button.tsx` does not exist.

- [ ] **Step 3: Implement minimum Button**

Use native `<button>` only. Default `type` to `button`; derive classes `ev-button ev-button--${variant} ev-button--${size}`; set `disabled={disabled || busy}` and `aria-busy={busy || undefined}`. Do not add icons/spinners in DS-001.

- [ ] **Step 4: Run GREEN and full suite**

```bash
pnpm vitest run src/components/ui/button.test.tsx
pnpm test:run
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/button.tsx src/components/ui/button.test.tsx
git commit -m "feat: add accessible button primitive"
```

---

### Task 3: Accessible field primitives

**Files:**
- Create: `src/components/ui/field-group.tsx`
- Create: `src/components/ui/text-field.tsx`
- Create: `src/components/ui/text-area.tsx`
- Create: `src/components/ui/select-field.tsx`
- Create: `src/components/ui/fields.test.tsx`

**Interfaces:**

```ts
export type FieldMessageProps = {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
};
export function FieldGroup(props: FieldMessageProps): React.ReactElement;

export type TextFieldProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, "id"> & {
  id: string;
  label: string;
  hint?: string;
  error?: string;
};
export function TextField(props: TextFieldProps): React.ReactElement;

export type TextAreaProps = Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, "id"> & {
  id: string;
  label: string;
  hint?: string;
  error?: string;
};
export function TextArea(props: TextAreaProps): React.ReactElement;

export type SelectOption = { value: string; label: string; disabled?: boolean };
export type SelectFieldProps = Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "id" | "children"> & {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  options: readonly SelectOption[];
};
export function SelectField(props: SelectFieldProps): React.ReactElement;
```

- [ ] **Step 1: Write failing accessibility tests**

Cover visible label lookup via `getByLabelText`, `${id}-hint`/`${id}-error`, `aria-describedby` ordering, `aria-invalid`, required marker text, disabled input/select, read-only input/textarea, and native option rendering.

- [ ] **Step 2: Run RED**

Run: `pnpm vitest run src/components/ui/fields.test.tsx`

Expected: FAIL because field primitives do not exist.

- [ ] **Step 3: Implement FieldGroup and native controls**

Each control receives `aria-describedby` only for existing hint/error IDs; when both exist use `"<id>-hint <id>-error"`. `aria-invalid` is `true` only when `error` is present. Do not use placeholder as label. Select stays native.

- [ ] **Step 4: Run GREEN and full suite**

```bash
pnpm vitest run src/components/ui/fields.test.tsx
pnpm test:run
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/field-group.tsx src/components/ui/text-field.tsx src/components/ui/text-area.tsx src/components/ui/select-field.tsx src/components/ui/fields.test.tsx
git commit -m "feat: add accessible field primitives"
```

---

### Task 4: Notice, status badge, and deadline indicator

**Files:**
- Create: `src/components/ui/notice.tsx`
- Create: `src/components/ui/status-badge.tsx`
- Create: `src/components/ui/deadline-indicator.tsx`
- Create: `src/components/ui/statuses.test.tsx`

**Interfaces:**

```ts
export type NoticeVariant = "info" | "warning" | "danger" | "privacy";
export function Notice(props: { variant?: NoticeVariant; title: string; children: React.ReactNode }): React.ReactElement;

export type StatusTone = "neutral" | "info" | "success" | "warning" | "danger";
export function StatusBadge(props: { tone?: StatusTone; children: React.ReactNode }): React.ReactElement;

export type DeadlineTone = "neutral" | "warning" | "danger";
export function DeadlineIndicator(props: {
  daysRemaining: number;
  label: string;
  tone: DeadlineTone;
}): React.ReactElement;
```

- [ ] **Step 1: Write failing semantic tests**

Verify Notice always renders title/body text and variant class; StatusBadge always has visible text; DeadlineIndicator formats `3 → D-3`, `0 → D-DAY`, `-2 → D+2`, preserves the exact caller label, and has no threshold calculation API.

- [ ] **Step 2: Run RED**

Run: `pnpm vitest run src/components/ui/statuses.test.tsx`

Expected: FAIL because components do not exist.

- [ ] **Step 3: Implement minimal semantic components**

`Notice` uses `<aside>` and does not use an assertive live region by default. `StatusBadge` uses a `<span>`. `DeadlineIndicator` renders the D-day value and exact label; tone only affects class names.

- [ ] **Step 4: Run GREEN and full suite**

```bash
pnpm vitest run src/components/ui/statuses.test.tsx
pnpm test:run
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/notice.tsx src/components/ui/status-badge.tsx src/components/ui/deadline-indicator.tsx src/components/ui/statuses.test.tsx
git commit -m "feat: add status and deadline primitives"
```

---

### Task 5: Empty and loading states

**Files:**
- Create: `src/components/ui/empty-state.tsx`
- Create: `src/components/ui/loading-state.tsx`
- Create: `src/components/ui/states.test.tsx`

**Interfaces:**

```ts
export function EmptyState(props: {
  title: string;
  description: string;
  action: React.ReactNode;
  secondary?: React.ReactNode;
}): React.ReactElement;

export function LoadingState(props: { label?: string }): React.ReactElement;
```

- [ ] **Step 1: Write failing tests**

Verify EmptyState renders one supplied primary action, optional secondary content, and readable title/description. Verify LoadingState exposes `role="status"`, `aria-busy="true"`, default Korean label `불러오는 중` and caller label override.

- [ ] **Step 2: Run RED**

Run: `pnpm vitest run src/components/ui/states.test.tsx`

Expected: FAIL because components do not exist.

- [ ] **Step 3: Implement minimal states**

Do not add decorative illustration, animation framework, or fake skeleton data. Loading markup must contain no protected record content.

- [ ] **Step 4: Run GREEN and full suite**

```bash
pnpm vitest run src/components/ui/states.test.tsx
pnpm test:run
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/empty-state.tsx src/components/ui/loading-state.tsx src/components/ui/states.test.tsx
git commit -m "feat: add empty and loading states"
```

---

### Task 6: Design-system documentation and release verification

**Files:**
- Create: `docs/design/DESIGN_SYSTEM.md`
- Modify: `docs/VERIFICATION.md`

**Interfaces:**
- Consumes: Tasks 1-5 public component contracts.
- Produces: stable usage guidance for Designer/Frontend Agents and exact CI evidence for DS-001.

- [ ] **Step 1: Document tokens and component usage**

`DESIGN_SYSTEM.md` documents each primitive's public props, approved variants/tones, deadline legal-neutrality rule, form accessibility rules, and non-goals. It must not claim manual browser checks that were not run.

- [ ] **Step 2: Run complete verification**

```bash
pnpm test:run
pnpm build
```

Expected: both commands PASS in GitHub Actions or another dependency-capable environment.

- [ ] **Step 3: Record evidence without fabrication**

Update `docs/VERIFICATION.md` only with actually observed command/CI results. If 320px/200% manual browser checks are unavailable, record them as pending for later Designer/QA browser validation instead of PASS.

- [ ] **Step 4: Commit**

```bash
git add docs/design/DESIGN_SYSTEM.md docs/VERIFICATION.md
git commit -m "docs: document design system contract"
```

- [ ] **Step 5: Open DS-001 PR to `develop`**

Title:

```text
feat : 증빙함 디자인 시스템 기반 추가
```

Use the user's fixed PR body format and include exact CI results.

---

## Self-Review

- **Spec coverage:** palette/status tokens, type/spacing/shape, Button, fields, Notice, StatusBadge, DeadlineIndicator, EmptyState, LoadingState, focus/keyboard hooks, responsive-safe primitive rules, legal-neutral deadline contract, no third-party UI dependency, and documentation are mapped to Tasks 1-6.
- **Placeholder scan:** no TBD/TODO/"implement later" steps remain. Browser-only checks that cannot be proven by unit/build CI are explicitly deferred to later Designer/QA validation rather than falsely marked complete.
- **Type consistency:** `DeadlineTone`, `StatusTone`, field IDs, hint/error IDs, Button variants/sizes, Notice variants, and state component props are defined once and used consistently.
- **Scope:** no dashboard/auth/timeline composition is implemented here; DS-001 remains an independently reviewable foundation task.

## Execution Handoff

Execute inline on `agent/해바라기/design-system/foundation` using the existing GitHub branch as the isolated workspace. Each RED/GREEN cycle is verified through repository tests/CI evidence before the next task is considered complete.