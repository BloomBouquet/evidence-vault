# 증빙함 (Evidence Vault)

구매·구독·렌탈·환불 과정에서 필요한 사실과 증빙을 비공개로 정리하고, 중요한 날짜를 사용자가 기록한 의미 그대로 관리하는 웹 서비스입니다.

## 저장소

- Canonical repository: `BloomBouquet/evidence-vault`
- Release branch: `main`
- Integration branch: `develop`
- Luna Agent branches: `agent/해바라기/<role>/<task>`

## 현재 구현된 기준선

- Next.js 16 / React 19 / TypeScript 앱 셸
- 반응형 랜딩 페이지와 `/api/health`
- 법률판단 서비스가 아님을 명시하는 공통 고지
- VaultItem / Deadline / EvidenceEvent / Case / Export domain 모델
- PostgreSQL + Drizzle schema
- VaultItem, EvidenceFile, Case, ExportPacket의 owner-scoped repository 조회
- 앱 세션 repository 기반
- 꽃다발 OAuth용 PKCE S256/state 및 암호화된 단기 login-attempt primitive
- Vitest 기반 domain/auth/ownership/health 테스트

## 아직 구현되지 않은 MVP 영역

- 꽃다발 OAuth callback/token exchange/userinfo/application session 완성
- Dashboard/Vault CRUD API와 UI
- private S3-compatible 증빙 업로드와 5분 signed download
- 이미지 redaction UX와 내보내기 제외 흐름
- 분쟁 준비 모드와 중립 체크리스트
- `summary.pdf + manifest.json + evidence/` ZIP export
- 삭제 reconciliation/account deletion
- Playwright E2E/PWA/production deployment

## 로컬 실행

```bash
cp .env.example .env.local
pnpm install
pnpm dev
```

검증 명령:

```bash
pnpm test:run
pnpm build
```

## 필요한 운영 입력

- 꽃다발 OAuth client ID와 정확한 production redirect URI
- PostgreSQL production database
- 한국 리전 우선의 private S3-compatible bucket 및 credentials
- 충분히 긴 `SESSION_SECRET`
- production domain/TLS
- 개인정보처리방침/이용약관 및 출시 직전 법무·개인정보 검토

실제 secret, `.env`, 사용자 증빙 파일, signed URL은 저장소에 커밋하지 않습니다. 자세한 제품 경계는 [`PRODUCT.md`](./PRODUCT.md), 팀 실행 규칙은 [`AGENTS.md`](./AGENTS.md)를 참고하세요.
