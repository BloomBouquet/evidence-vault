"use client";

import { Button } from "@/src/components/ui/button";
import { useAuthSession } from "./auth-session-provider";

const LOGIN_HREF = "/auth/bouquet/start?returnTo=/dashboard";

export function AuthEntryAction({ placement }: { placement: "nav" | "hero" }) {
  const session = useAuthSession();
  const className = placement === "nav" ? "nav-login" : "primary-button";

  if (session.status === "checking") {
    return (
      <span className={className} aria-busy="true">
        로그인 상태 확인 중
      </span>
    );
  }

  if (session.status === "error") {
    return (
      <span className="auth-entry-error" role="status">
        <span>로그인 상태를 확인하지 못했어요.</span>
        <Button size="sm" variant="secondary" onClick={session.retry}>다시 확인</Button>
        <a href={LOGIN_HREF}>꽃다발로 로그인</a>
      </span>
    );
  }

  if (session.status === "authenticated") {
    return (
      <a className={className} href="/dashboard">
        {placement === "nav" ? "증빙함 열기" : "내 증빙함 열기"}
        {placement === "hero" ? <span aria-hidden="true"> ↗</span> : null}
      </a>
    );
  }

  return (
    <a className={className} href={LOGIN_HREF}>
      {placement === "nav" ? "꽃다발로 로그인" : "꽃다발로 시작하기"}
      {placement === "hero" ? <span aria-hidden="true"> ↗</span> : null}
    </a>
  );
}
