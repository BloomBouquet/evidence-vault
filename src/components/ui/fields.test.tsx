import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SelectField } from "./select-field";
import { TextArea } from "./text-area";
import { TextField } from "./text-field";

describe("field primitives", () => {
  it("associates a visible label, hint, and error with a text input", () => {
    render(
      <TextField
        id="merchant"
        label="판매처"
        hint="주문 내역에 표시된 이름을 적어주세요."
        error="판매처를 입력해주세요."
        required
      />,
    );

    const input = screen.getByLabelText("판매처 필수");
    expect(input).toHaveAttribute("id", "merchant");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAttribute("aria-describedby", "merchant-hint merchant-error");
    expect(screen.getByText("주문 내역에 표시된 이름을 적어주세요.")).toHaveAttribute("id", "merchant-hint");
    expect(screen.getByText("판매처를 입력해주세요.")).toHaveAttribute("id", "merchant-error");
  });

  it("omits invalid and describedby attributes when there are no messages", () => {
    render(<TextField id="title" label="거래 이름" defaultValue="무선 이어폰" />);
    const input = screen.getByLabelText("거래 이름");
    expect(input).not.toHaveAttribute("aria-invalid");
    expect(input).not.toHaveAttribute("aria-describedby");
  });

  it("preserves native disabled and read-only behavior", () => {
    render(
      <>
        <TextField id="disabled-field" label="비활성 입력" disabled />
        <TextArea id="readonly-note" label="기록 메모" readOnly defaultValue="사실 기록" />
      </>,
    );

    expect(screen.getByLabelText("비활성 입력")).toBeDisabled();
    expect(screen.getByLabelText("기록 메모")).toHaveAttribute("readonly");
  });

  it("renders a native select with controlled domain options", () => {
    render(
      <SelectField
        id="category"
        label="거래 유형"
        defaultValue="online_purchase"
        options={[
          { value: "online_purchase", label: "온라인 구매" },
          { value: "rental", label: "렌탈" },
          { value: "disabled", label: "사용 불가", disabled: true },
        ]}
      />,
    );

    const select = screen.getByLabelText("거래 유형");
    expect(select.tagName).toBe("SELECT");
    expect(screen.getByRole("option", { name: "온라인 구매" })).toHaveValue("online_purchase");
    expect(screen.getByRole("option", { name: "사용 불가" })).toBeDisabled();
  });
});
