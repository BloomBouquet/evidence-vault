import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DeadlineIndicator } from "./deadline-indicator";
import { Notice } from "./notice";
import { StatusBadge } from "./status-badge";

describe("status primitives", () => {
  it("renders notice title and body with an explicit variant", () => {
    render(<Notice variant="privacy" title="개인정보 확인">주민등록번호는 가리고 올려주세요.</Notice>);
    const notice = screen.getByRole("complementary", { name: "개인정보 확인" });
    expect(notice).toHaveClass("ev-notice--privacy");
    expect(screen.getByText("주민등록번호는 가리고 올려주세요.")).toBeInTheDocument();
  });

  it("keeps status meaning in visible text", () => {
    render(<StatusBadge tone="success">업로드 완료</StatusBadge>);
    const badge = screen.getByText("업로드 완료");
    expect(badge).toHaveClass("ev-badge--success");
  });

  it.each([
    [3, "D-3"],
    [0, "D-DAY"],
    [-2, "D+2"],
  ])("formats %s days without deciding the urgency threshold", (daysRemaining, expected) => {
    render(
      <DeadlineIndicator
        daysRemaining={daysRemaining}
        label="반품 가능일로 기록한 날짜"
        tone="warning"
      />,
    );

    expect(screen.getByText(expected)).toBeInTheDocument();
    expect(screen.getByText("반품 가능일로 기록한 날짜")).toBeInTheDocument();
    expect(screen.getByText(expected).closest("div")).toHaveClass("ev-deadline--warning");
  });
});
