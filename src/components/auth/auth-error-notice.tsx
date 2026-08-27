import { Notice } from "@/src/components/ui/notice";

const LOGIN_HREF = "/auth/bouquet/start?returnTo=/dashboard";

export function AuthErrorNotice({ code }: { code?: string | null }) {
  if (!code) return null;

  const sessionRequired = code === "session_required";
  const title = sessionRequired ? "로그인이 필요해요." : "로그인을 완료하지 못했어요.";
  const body = sessionRequired
    ? "이 화면을 열려면 현재 증빙함 세션이 필요합니다. 꽃다발 인증으로 다시 연결해주세요."
    : "꽃다발 인증이 끝까지 완료되지 않았습니다. 잠시 후 다시 시도해주세요.";

  return (
    <div className="landing-auth-notice">
      <Notice variant={sessionRequired ? "info" : "danger"} title={title}>
        <p>{body}</p>
        <div className="auth-notice-actions">
          <a href={LOGIN_HREF}>꽃다발로 다시 로그인</a>
          <a href="/">홈으로 돌아가기</a>
        </div>
      </Notice>
    </div>
  );
}
