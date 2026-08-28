import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { SessionProbeResult } from "@/src/auth/client-session";
import { AuthSessionProvider } from "./auth-session-provider";
import { AuthEntryAction } from "./auth-entry-action";

function renderAction(
  placement: "nav" | "hero",
  probe: () => Promise<SessionProbeResult>,
) {
  return render(
    <AuthSessionProvider probe={probe}>
      <AuthEntryAction placement={placement} />
    </AuthSessionProvider>,
  );
}

describe("AuthEntryAction", () => {
  it("shows a non-navigation checking state", () => {
    const probe = vi.fn(() => new Promise<SessionProbeResult>(() => undefined));
    renderAction("hero", probe);

    const checking = screen.getByText("로그인 상태 확인 중");
    expect(checking).toHaveAttribute("aria-busy", "true");
    expect(checking.closest("a")).toBeNull();
  });

  it.each([
    ["nav" as const, "꽃다발로 로그인"],
    ["hero" as const, "꽃다발로 시작하기"],
  ])("links anonymous %s entry to Bouquet start", async (placement, label) => {
    renderAction(placement, async () => ({ status: "anonymous" }));

    const link = await screen.findByRole("link", { name: new RegExp(label) });
    expect(link).toHaveAttribute("href", "/auth/bouquet/start?returnTo=/dashboard");
  });

  it.each([
    ["nav" as const, "증빙함 열기"],
    ["hero" as const, "내 증빙함 열기"],
  ])("links authenticated %s entry to dashboard", async (placement, label) => {
    renderAction(placement, async () => ({
      status: "authenticated",
      user: { id: "user-1", displayName: "순우" },
    }));

    const link = await screen.findByRole("link", { name: new RegExp(label) });
    expect(link).toHaveAttribute("href", "/dashboard");
  });

  it("offers retry and direct login recovery after probe failure", async () => {
    const probe = vi.fn<() => Promise<SessionProbeResult>>()
      .mockRejectedValueOnce(new Error("private network detail"))
      .mockResolvedValueOnce({ status: "anonymous" });

    renderAction("hero", probe);

    expect(await screen.findByText("로그인 상태를 확인하지 못했어요.")).toBeInTheDocument();
    expect(screen.queryByText("private network detail")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "꽃다발로 로그인" })).toHaveAttribute(
      "href",
      "/auth/bouquet/start?returnTo=/dashboard",
    );

    fireEvent.click(screen.getByRole("button", { name: "다시 확인" }));
    expect(await screen.findByRole("link", { name: /꽃다발로 시작하기/ })).toHaveAttribute(
      "href",
      "/auth/bouquet/start?returnTo=/dashboard",
    );
  });
});
