import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { resolveProtectedUser } from "@/src/auth/protected-session";
import { ProtectedShell } from "@/src/components/auth/protected-shell";
import { appPath } from "@/src/routing/app-path";

export default async function ProtectedLayout({ children }: { children: ReactNode }) {
  const cookieStore = await cookies();
  const rawToken = cookieStore.get("ev_session")?.value ?? null;
  const user = await resolveProtectedUser(rawToken);

  if (!user) {
    redirect(appPath("/?auth_error=session_required"));
  }

  return <ProtectedShell user={user}>{children}</ProtectedShell>;
}
