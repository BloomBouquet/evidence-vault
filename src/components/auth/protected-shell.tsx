import Link from "next/link";
import type { ReactNode } from "react";

export function ProtectedShell({
  user,
  children,
}: {
  user: { id: string; displayName: string };
  children: ReactNode;
}) {
  return (
    <div className="protected-shell">
      <header className="protected-header">
        <Link className="protected-brand" href="/dashboard" aria-label="증빙함 대시보드">
          <span className="brand-mark" aria-hidden="true">증</span>
          <span>증빙함</span>
        </Link>

        <nav className="protected-nav" aria-label="증빙함 메뉴">
          <Link href="/dashboard" aria-current="page">증빙함</Link>
          <span>분쟁 준비</span>
          <span>가이드</span>
          <span>계정</span>
        </nav>

        <div className="protected-identity" aria-label="현재 증빙함 사용자">
          <span>{user.displayName}</span>
        </div>
      </header>

      <main className="protected-main">{children}</main>
    </div>
  );
}
