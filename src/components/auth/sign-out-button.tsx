"use client";

import { useState } from "react";
import { Button } from "@/src/components/ui/button";
import { Notice } from "@/src/components/ui/notice";
import { appPath } from "@/src/routing/app-path";

type SignOutButtonProps = {
  fetchImpl?: typeof fetch;
  navigate?: (path: string) => void;
};

function defaultNavigate(path: string) {
  window.location.assign(path);
}

export function SignOutButton({
  fetchImpl = fetch,
  navigate = defaultNavigate,
}: SignOutButtonProps) {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function signOut() {
    if (busy) return;

    setBusy(true);
    setFailed(false);

    try {
      const response = await fetchImpl(appPath("/auth/sign-out"), {
        method: "POST",
        credentials: "same-origin",
      });
      if (!response.ok) throw new Error("project_sign_out_failed");
      navigate(appPath("/"));
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="project-sign-out">
      <span className="project-sign-out__note">현재 증빙함 세션을 종료합니다.</span>
      <Button
        variant="ghost"
        size="sm"
        busy={busy}
        onClick={signOut}
      >
        로그아웃
      </Button>

      {failed ? (
        <Notice variant="danger" title="로그아웃을 완료하지 못했어요.">
          <p>증빙함 세션 종료를 다시 시도해주세요.</p>
          <Button variant="secondary" size="sm" onClick={signOut}>다시 시도</Button>
        </Notice>
      ) : null}
    </div>
  );
}
