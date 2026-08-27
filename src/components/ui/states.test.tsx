import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EmptyState } from "./empty-state";
import { LoadingState } from "./loading-state";

describe("application states", () => {
  it("renders a clear empty state with the supplied primary action", () => {
    render(
      <EmptyState
        title="아직 증빙함이 없어요"
        description="첫 거래를 등록하면 중요한 날짜와 기록을 한곳에서 볼 수 있어요."
        action={<a href="/vault/new">첫 증빙함 만들기</a>}
        secondary={<a href="/guide">사용 방법 보기</a>}
      />,
    );

    expect(screen.getByRole("heading", { name: "아직 증빙함이 없어요" })).toBeInTheDocument();
    expect(screen.getByText("첫 거래를 등록하면 중요한 날짜와 기록을 한곳에서 볼 수 있어요.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "첫 증빙함 만들기" })).toHaveAttribute("href", "/vault/new");
    expect(screen.getByRole("link", { name: "사용 방법 보기" })).toBeInTheDocument();
  });

  it("exposes a non-leaking default loading status", () => {
    render(<LoadingState />);
    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("aria-busy", "true");
    expect(status).toHaveTextContent("불러오는 중");
  });

  it("allows a caller-specific loading label", () => {
    render(<LoadingState label="세션 확인 중" />);
    expect(screen.getByRole("status")).toHaveTextContent("세션 확인 중");
  });
});
