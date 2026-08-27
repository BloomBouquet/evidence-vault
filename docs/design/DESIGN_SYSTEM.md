# Evidence Vault Design System

증빙함의 디자인 시스템은 **사실 기록·증빙·개인정보를 차분하게 다루는 문서형 UI**를 위한 최소 공통 계층입니다. 기존 warm paper / dark ink / restrained green 정체성을 유지하며, 페이지별 임의 색상과 제어 컴포넌트 복제를 줄입니다.

## Style layers

- `src/styles/tokens.css`: semantic color, spacing, radius, control height, typography, focus tokens.
- `src/styles/primitives.css`: 공통 UI primitive class와 접근성 상태.
- `app/globals.css`: reset/base와 랜딩 페이지 조합. 기존 랜딩 변수는 semantic token alias로 연결되어 있습니다.

새 컴포넌트는 raw 색상값보다 `--color-*`, `--space-*`, `--control-height-*`, `--focus-ring`을 사용합니다. 상태 의미는 색상만으로 전달하지 않습니다.

## Button

```tsx
<Button variant="primary" size="md">저장</Button>
<Button variant="danger" busy>삭제 중</Button>
```

Public contract:

```ts
type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md";
type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  busy?: boolean;
};
```

- native `<button>`을 사용합니다.
- 기본 `type`은 `button`입니다.
- `busy`는 `aria-busy="true"`와 disabled 상태를 함께 적용합니다.
- 일반 control은 최소 44px target을 유지합니다.

## Form fields

```tsx
<TextField
  id="merchant"
  label="판매처"
  hint="주문 내역에 표시된 이름을 적어주세요."
  error={error}
  required
/>
```

제공 컴포넌트:

- `FieldGroup`
- `TextField`
- `TextArea`
- `SelectField`

규칙:

- 모든 필드는 명시적 `id`와 visible `label`을 받습니다.
- placeholder-only label은 사용하지 않습니다.
- hint는 `<id>-hint`, error는 `<id>-error`로 생성됩니다.
- 존재하는 메시지만 `aria-describedby`에 연결됩니다.
- error가 있을 때만 `aria-invalid="true"`가 적용됩니다.
- `SelectField`는 MVP에서 native `<select>`를 사용합니다.
- disabled/readOnly semantics는 native attribute를 유지합니다.

## Notice

```tsx
<Notice variant="privacy" title="개인정보 확인">
  주민등록번호 등 불필요한 개인정보는 가리고 올려주세요.
</Notice>
```

Variants:

- `info`
- `warning`
- `danger`
- `privacy`

Notice는 기본적으로 assertive live region이 아닙니다. 내용과 제목이 항상 보이기 때문에 색상 없이도 의미를 이해할 수 있어야 합니다.

## StatusBadge

```tsx
<StatusBadge tone="success">업로드 완료</StatusBadge>
```

Tones:

- `neutral`
- `info`
- `success`
- `warning`
- `danger`

Badge는 짧은 상태 텍스트를 위한 컴포넌트입니다. 아이콘이나 색상만으로 상태를 표현하면 안 됩니다.

## DeadlineIndicator

```tsx
<DeadlineIndicator
  daysRemaining={3}
  label="반품 가능일로 기록한 날짜"
  tone="warning"
/>
```

```ts
type DeadlineTone = "neutral" | "warning" | "danger";
```

표시는 `D-3`, `D-DAY`, `D+2`처럼 상대 날짜만 계산합니다.

**중요:** 이 컴포넌트는 어떤 날짜가 법적 기한인지, 며칠 전부터 위험인지 판단하지 않습니다. `tone`과 source-labelled `label`은 호출자가 명시적으로 전달해야 합니다. `반품 기한`처럼 서비스가 법적 결론을 내리는 문구로 자동 변환하지 않습니다.

## EmptyState

```tsx
<EmptyState
  title="아직 증빙함이 없어요"
  description="첫 거래를 등록하면 중요한 날짜와 기록을 한곳에서 볼 수 있어요."
  action={<a href="/vault/new">첫 증빙함 만들기</a>}
/>
```

구조는 title → 설명 → primary action → optional secondary 순서입니다. MVP에서는 장식용 illustration을 요구하지 않습니다.

## LoadingState

```tsx
<LoadingState />
<LoadingState label="세션 확인 중" />
```

- `role="status"`
- `aria-busy="true"`
- 기본 문구 `불러오는 중`

로딩 컴포넌트에는 보호된 증빙/계정 데이터를 skeleton text처럼 넣지 않습니다. 초기 auth/session 확인에서도 protected-content flash가 없어야 합니다.

## Accessibility contract

공통 primitive가 제공하는 기반:

- visible `:focus-visible` treatment
- 최소 control target 높이
- form label/hint/error programmatic association
- status meaning not color-only
- long text wrapping and 320px-safe primitive rules
- reduced-motion preference가 있는 경우 loading spinner animation 비활성화

브라우저 기반 320px viewport, 200% zoom, 실제 keyboard traversal, contrast 측정은 Designer/QA의 browser validation에서도 다시 확인해야 합니다. 이 문서는 해당 수동 검증을 이미 통과했다고 주장하지 않습니다.

## Product-specific constraints

- 증빙 자료는 private-by-default라는 인상을 유지합니다.
- 삭제/오류/개인정보 경고는 명시적인 텍스트를 사용합니다.
- SHA-256은 `무결성 지문` 또는 변경 감지 값으로만 설명하고 법적 진정성·증거능력을 보장한다고 표현하지 않습니다.
- D-day 강조는 proximity 표현이지 법률 판단이 아닙니다.

## Non-goals

이 design-system foundation은 다음을 제공하지 않습니다.

- 완성된 dashboard/navigation composition
- 인증 페이지 전체 설계
- timeline/upload flow
- case/export flow
- dialog framework
- dark mode
- custom icon library
- chart/KPI system
- third-party component library

해당 화면 구성은 후속 Designer/Frontend Agent가 이 contract 위에서 결정합니다.
