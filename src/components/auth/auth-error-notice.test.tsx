import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AuthErrorNotice } from "./auth-error-notice";

describe("AuthErrorNotice", () => {
  it("renders neutral OAuth failure recovery", () => {
    render(<AuthErrorNotice code="oauth_failed" />);

    expect(screen.getByText("로그인을 완료하지 못했어요.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "꽃다발로 다시 로그인" })).toHaveAttribute(
      "href",
      "/auth/bouquet/start?returnTo=/dashboard",
    );
    expect(screen.getByRole("link", { name: "홈으로 돌아가기" })).toHaveAttribute("href", "/");
  });

  it("explains a missing project session without claiming central logout", () => {
    render(<AuthErrorNotice code="session_required" />);

    expect(screen.getByText("로그인이 필요해요.")).toBeInTheDocument();
    expect(screen.getByText(/현재 증빙함 세션/)).toBeInTheDocument();
    expect(screen.queryByText(/꽃다발 계정에서 로그아웃/)).not.toBeInTheDocument();
  });

  it("never renders an unknown raw auth error value", () => {
    render(<AuthErrorNotice code="provider_access_token_secret" />);

    expect(screen.getByText("로그인을 완료하지 못했어요.")).toBeInTheDocument();
    expect(screen.queryByText("provider_access_token_secret")).not.toBeInTheDocument();
  });

  it("renders nothing without an auth error", () => {
    const { container } = render(<AuthErrorNotice code={null} />);
    expect(container).toBeEmptyDOMElement();
  });
});
