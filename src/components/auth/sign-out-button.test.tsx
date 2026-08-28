import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SignOutButton } from "./sign-out-button";

describe("SignOutButton", () => {
  it("POSTs the project sign-out endpoint and navigates home", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ success: true }), { status: 200 })) as unknown as typeof fetch;
    const navigate = vi.fn();

    render(<SignOutButton fetchImpl={fetchImpl} navigate={navigate} />);
    fireEvent.click(screen.getByRole("button", { name: "로그아웃" }));

    await waitFor(() => expect(navigate).toHaveBeenCalledWith("/"));
    expect(fetchImpl).toHaveBeenCalledWith("/auth/sign-out", {
      method: "POST",
      credentials: "same-origin",
    });
  });

  it("disables the action and exposes busy state while sign-out is pending", async () => {
    let resolveResponse!: (response: Response) => void;
    const fetchImpl = vi.fn(() => new Promise<Response>((resolve) => { resolveResponse = resolve; })) as unknown as typeof fetch;

    render(<SignOutButton fetchImpl={fetchImpl} navigate={vi.fn()} />);
    const button = screen.getByRole("button", { name: "로그아웃" });
    fireEvent.click(button);

    await waitFor(() => expect(button).toBeDisabled());
    expect(button).toHaveAttribute("aria-busy", "true");

    resolveResponse(new Response(JSON.stringify({ success: true }), { status: 200 }));
  });

  it("shows neutral retryable copy for a failed response without rendering the body", async () => {
    const fetchImpl = vi.fn<() => Promise<Response>>()
      .mockResolvedValueOnce(new Response("central-provider-secret-detail", { status: 500 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ success: true }), { status: 200 }));
    const navigate = vi.fn();

    render(<SignOutButton fetchImpl={fetchImpl as unknown as typeof fetch} navigate={navigate} />);
    fireEvent.click(screen.getByRole("button", { name: "로그아웃" }));

    expect(await screen.findByText("로그아웃을 완료하지 못했어요.")).toBeInTheDocument();
    expect(screen.queryByText("central-provider-secret-detail")).not.toBeInTheDocument();
    expect(navigate).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));
    await waitFor(() => expect(navigate).toHaveBeenCalledWith("/"));
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("describes the action as Evidence Vault sign-out only", () => {
    render(<SignOutButton fetchImpl={vi.fn() as unknown as typeof fetch} navigate={vi.fn()} />);

    expect(screen.getByText("현재 증빙함 세션을 종료합니다.")).toBeInTheDocument();
    expect(screen.queryByText(/꽃다발.*로그아웃/)).not.toBeInTheDocument();
  });
});
