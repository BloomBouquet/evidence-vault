export type PublicSessionUser = {
  id: string;
  displayName: string;
};

export type SessionProbeResult =
  | { status: "anonymous" }
  | { status: "authenticated"; user: PublicSessionUser };

function failed(): never {
  throw new Error("session_probe_failed");
}

export async function probeSession(
  fetchImpl: typeof fetch = fetch,
): Promise<SessionProbeResult> {
  try {
    const response = await fetchImpl("/auth/session", {
      method: "GET",
      cache: "no-store",
      credentials: "same-origin",
    });

    if (!response.ok) failed();

    const payload = await response.json() as unknown;
    if (!payload || typeof payload !== "object" || !("user" in payload)) failed();

    const user = payload.user;
    if (user === null) return { status: "anonymous" };
    if (!user || typeof user !== "object") failed();

    const id = "id" in user ? user.id : null;
    const displayName = "displayName" in user ? user.displayName : null;
    if (
      typeof id !== "string" ||
      !id.trim() ||
      typeof displayName !== "string" ||
      !displayName.trim()
    ) {
      failed();
    }

    return {
      status: "authenticated",
      user: {
        id: id.trim(),
        displayName: displayName.trim(),
      },
    };
  } catch (error) {
    if (error instanceof Error && error.message === "session_probe_failed") throw error;
    failed();
  }
}
