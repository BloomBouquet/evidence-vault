"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  probeSession,
  type PublicSessionUser,
  type SessionProbeResult,
} from "@/src/auth/client-session";

type AuthSessionSnapshot =
  | { status: "checking" }
  | { status: "anonymous" }
  | { status: "authenticated"; user: PublicSessionUser }
  | { status: "error" };

export type AuthSessionState =
  | { status: "checking"; retry(): void }
  | { status: "anonymous"; retry(): void }
  | { status: "authenticated"; user: PublicSessionUser; retry(): void }
  | { status: "error"; retry(): void };

const AuthSessionContext = createContext<AuthSessionState | null>(null);

export function AuthSessionProvider({
  children,
  probe = probeSession,
}: {
  children: ReactNode;
  probe?: () => Promise<SessionProbeResult>;
}) {
  const [snapshot, setSnapshot] = useState<AuthSessionSnapshot>({ status: "checking" });
  const [attempt, setAttempt] = useState(0);

  const retry = useCallback(() => {
    setAttempt((value) => value + 1);
  }, []);

  useEffect(() => {
    let active = true;
    setSnapshot({ status: "checking" });

    probe()
      .then((result) => {
        if (!active) return;
        setSnapshot(result);
      })
      .catch(() => {
        if (!active) return;
        setSnapshot({ status: "error" });
      });

    return () => {
      active = false;
    };
  }, [attempt, probe]);

  const value = useMemo<AuthSessionState>(() => ({ ...snapshot, retry }), [snapshot, retry]);

  return <AuthSessionContext.Provider value={value}>{children}</AuthSessionContext.Provider>;
}

export function useAuthSession() {
  const context = useContext(AuthSessionContext);
  if (!context) throw new Error("auth_session_provider_missing");
  return context;
}
