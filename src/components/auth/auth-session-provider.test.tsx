import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { SessionProbeResult } from "@/src/auth/client-session";
import { AuthSessionProvider, useAuthSession } from "./auth-session-provider";

function StateProbe() {
  const state = useAuthSession();
  return (
    <div>
      <span>{state.status}</span>
      {state.status === "authenticated" ? <span>{state.user.displayName}</span> : null}
      <button type="button" onClick={state.retry}>retry</button>
    </div>
  );
}

describe("AuthSessionProvider", () => {
  it("starts checking and then becomes anonymous", async () => {
    let resolveProbe!: (result: SessionProbeResult) => void;
    const probe = vi.fn(() => new Promise<SessionProbeResult>((resolve) => { resolveProbe = resolve; }));

    render(<AuthSessionProvider probe={probe}><StateProbe /></AuthSessionProvider>);
    expect(screen.getByText("checking")).toBeInTheDocument();

    resolveProbe({ status: "anonymous" });
    expect(await screen.findByText("anonymous")).toBeInTheDocument();
    expect(probe).toHaveBeenCalledTimes(1);
  });

  it("exposes only the authenticated local user", async () => {
    const probe = vi.fn(async (): Promise<SessionProbeResult> => ({
      status: "authenticated",
      user: { id: "user-1", displayName: "순우" },
    }));

    render(<AuthSessionProvider probe={probe}><StateProbe /></AuthSessionProvider>);

    expect(await screen.findByText("authenticated")).toBeInTheDocument();
    expect(screen.getByText("순우")).toBeInTheDocument();
  });

  it("enters error state and retries the probe", async () => {
    const probe = vi.fn<() => Promise<SessionProbeResult>>()
      .mockRejectedValueOnce(new Error("network detail"))
      .mockResolvedValueOnce({ status: "anonymous" });

    render(<AuthSessionProvider probe={probe}><StateProbe /></AuthSessionProvider>);

    expect(await screen.findByText("error")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "retry" }));

    await waitFor(() => expect(screen.getByText("anonymous")).toBeInTheDocument());
    expect(probe).toHaveBeenCalledTimes(2);
  });
});
