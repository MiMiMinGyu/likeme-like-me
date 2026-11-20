# 배포 증거 스크린샷

포트폴리오 글에서 바로 쓰기 위한 캡처 모음. 파일명은 `번호-대상-내용.png`, 번호는 촬영 순서.
01~07은 다크 배경으로 재촬영한 것이 현재 버전이다.

이력 정리 안내: 표의 이미지 태그 `987809f`는 이력 정리 전 커밋 해시이며, 현재 이력에서는 `f9658a9`에 해당한다. 다른 해시의 대응은 [REFACTORING_LOG](../REFACTORING_LOG.md) 맨 위에 있다.

**공개 전 규칙**: 계정 ID(12자리)·액세스 키 ID·이메일·IP·도메인 토큰은 가린 사본만 둔다.
가린 항목은 아래 표의 "마스킹"에 적는다. 원본은 이 폴더에 두지 않는다.

| 파일 | 보여주는 것 | 마스킹 | 비고 |
|---|---|---|---|
| 01-budgets-guard-10usd.png | 월 $10 비용 예산(`likemelikeme-deploy-guard`) 정상, 알림 2건 | 이메일 주소 검은 박스 | 예산 이름·임계값은 안 보임 |
| 02-iam-access-key-inactive.png | IAM 사용자 `likemelikeme-deploy` 요약: 액세스 키 Inactive(생성·마지막 사용 62일 전) | ARN 속 계정 ID, 키 ID 검은 박스 | 보안 정리 "이전" 증거. "이후"는 47번. 콘솔 액세스는 "MFA로 활성화됨"으로 표시됨 |
| 03-ecr-repositories-3.png | ECR 프라이빗 리포지토리 3개 (AES-256) | URI 속 계정 ID 검은 박스 | |
| 04-ecr-likeme-api-image-index.png | api 이미지 `987809f`, 289.47MB | 없음 | amd64 이미지 풀링 시각 12:03:16 = EC2가 pull한 시각 |
| 05-ecr-likeme-embedding-image-index.png | embedding 이미지 `987809f`, 744.31MB | 없음 | 위와 동일 |
| 06-ecr-likeme-web-image-index.png | web 이미지 `987809f`, 24.03MB | 없음 | 위와 동일 |
| 07-ssm-parameters-prod.png | SSM `/likemelikeme/prod/*` **9개**. 비밀 3종(JWT_SECRET, OPENAI_API_KEY, POSTGRES_PASSWORD) SecureString, 나머지 String. 값은 미노출 | 없음 (값·계정 ID 없음) | 텔레그램 토큰·사용자 ID 삭제 후 상태. "시크릿은 이미지·레포가 아니라 SSM" 증거 |
| 08-terraform-apply-outputs.png | `Apply complete! Resources: 6 added` + outputs(instance_id, public_ip, ssh, ssm_prefix) | 없음 (계정 ID·사용자명 없음) | EIP·인스턴스는 teardown 시 삭제되는 임시 값 |
| 09-duckdns-eip-updated.png | DuckDNS `likemelikeme.duckdns.org` → EIP 연결 성공 | 없음 (token 미노출) | 직전 시도의 "already … not updated" 오류 화면은 혼동 소지가 있어 제외 |
| 10-ec2-instance-details-tab.png | EC2 세부 정보: AL2023 AMI, 시작 시 키페어 `likemelikeme`, vCPU 2 | 소유자 칸 마스킹 | |
| 11-ec2-instance-summary.png | t3.small, 실행 중, EIP 연결, IAM 역할 `likemelikeme-ec2`, **IMDSv2 Required** | ARN 속 계정 ID 마스킹 | IMDSv2 강제 증거 |
| 12-ec2-security-sg-inbound.png | SG 인바운드 443/80 전체, 22는 특정 IP만. 아웃바운드 전체 | 소유자 ID, 22번 소스 IP 마스킹 | 개선 A(SSH 폐쇄) "이전" 증거 |
| 13-server-fetch-secrets.png | EC2에서 `fetch-secrets.sh` → "11 개 변수", `.env` 권한 `-rw-------` | 없음 (값 미출력) | 시크릿이 서버 `.env`(600)에만 존재. 이후 텔레그램 삭제로 9개가 됨 |
| 14-server-compose-up-api-unhealthy.png | `compose up` 결과: 이미지 4개 pull 성공, **likeme-api unhealthy로 의존 실패** | 없음 | 트러블슈팅 "수정 전" 증거. `docker login` 평문 저장 경고도 보임 (개선 후보) |
| 15-troubleshoot-migration-p3018-root-cause.png | 원인 로그: 4번째 마이그레이션에서 `P3018 / column does not have dimensions` | 없음 | init이 차원 없는 `vector`를 만들고, HNSW 인덱스가 먼저 실행됨 |
| 16-troubleshoot-migration-recovery.png | 복구: api 중지 → 3개 컬럼 `vector(768)` 지정 → `migrate resolve --rolled-back` | 없음 | Prisma 문서화 복구 절차. 서버 DB는 비어 있어 무손실 |
| 17-server-compose-ps-healthy.png | 복구 후 `ps`: 4개 서비스 healthy/Started, 80·443만 호스트 노출 | 이미지 주소의 계정 ID 검은 박스 | 호스트 노출 포트 80/443뿐, db 5432/api 3000은 내부 전용 |
| 18-web-login-page.png | 배포된 웹 UI(로그인 필요 화면) | 없음 | 주소창이 잘려 HTTPS 자물쇠는 안 보임 → 20·21번이 HTTPS 증거 |
| 19-https-certificate-letsencrypt.png | 인증서 뷰어: CN `likemelikeme.duckdns.org`, 발급자 Let's Encrypt(YE1), 유효 2026-11-12 ~ 2027-02-10 | 없음 (공개 정보) | Caddy 자동 발급 증거 |
| 20-https-address-bar.png | 주소창 `https://likemelikeme.duckdns.org` + 로그인 화면 | 없음 (북마크 바·프로필 아이콘이 보임, 허용) | HTTPS 증거 |
| 21-https-connection-secure.png | Chrome 보안 팝업 "이 연결은 안전합니다" | 없음 (북마크 바 일부 보임) | HTTPS 증거 |
| 22-server-memory-swap-docker-stats.png | EC2 `free -h`/`swapon --show`/`docker stats`: 전체 사용 698Mi/1.9Gi, swap 2GB(사용 3MiB), **embedding 318.5MiB(16.7%)**, api 66MiB, db 62MiB, web 14MiB | "Last login from" 줄의 접속 IP 검은 박스 | t3.small로 4개 서비스 수용 증거. 프롬프트의 Windows 사용자명은 남김 |
| 23-web-signup-form.png | 웹 회원가입 폼 (가상 데모 계정, 비밀번호는 점으로 가려짐) | 없음 | 클라우드 배포본에서 가입 |
| 24-web-login-success-empty-chat.png | 로그인 성공 후 채팅 화면. "메시지가 없습니다 / 텔레그램 봇으로 메시지를 보내보세요" | 없음 | **데이터 적재 전 빈 상태.** 적재 후 화면과 대비 |
| 25-network-port-check.png | 외부에서 `Test-NetConnection`: 443 `True`, 5432·3000 `False`(TimedOut) | 없음 (사설 IP 192.168.x.x·Windows 사용자명 보임, 허용) | 호스트에 열린 포트가 80/443뿐이라는 외부 증거 |
| 26-web-conversation-list-7-demo-partners.png | 적재 후 채팅 화면: 가상 상대 7명과 수신 메시지 | 없음 (가상 데이터) | 24번(빈 상태)과 대비 |
| 27-web-ai-recommendations-boss-before-fix.png | 가상 상대 "김 부장님"의 메시지에 AI 추천 답변 3개 생성 | 없음 | 클라우드 경로 전체(웹→api→임베딩→pgvector→OpenAI) 동작 증거. **헤더가 "관계 미설정"** → Caddy 라우팅 버그 "수정 전" 증거 |
| 28-web-ai-recommendations-junior-before-fix.png | 가상 상대 "수진"의 메시지에 AI 추천 답변 3개 | 없음 | 위와 동일(수정 전). 추천 문장은 무난한 일반 어투 — 품질은 이번 범위 밖 |
| 29-api-test-db-counts.png | `/test-db` 응답: users 1 / partners 7 / relationships 7 | 없음 | 적재 결과 확인 |
| 30-browser-console-relationship-error.png | 브라우저 콘솔: `[관계 조회] 실패: TypeError: y.find is not a function` | 없음 | 수정 전 `/relationships`가 JSON 대신 HTML을 돌려줘 `.find()`가 실패. 수정 후에도 **캐시된 HTML 응답** 때문에 일반 창에서 증상이 이어짐 |
| 31-web-ai-recommendations-boss-after-fix.png | 수정 후(시크릿 창): 헤더가 "상사/교수/임원"으로 표시 + AI 추천 3개 | 없음 | Caddy 라우팅 수정 "후" 증거 |
| 32-web-ai-recommendations-junior-after-fix.png | 수정 후: "후배/인턴/팀원" + AI 추천 3개 | 없음 | 위와 동일 |
| 33-web-ai-recommendations-mother-after-fix.png | 수정 후: "어른 가족 (부모/조부모)" + AI 추천 3개 | 없음 | 위와 동일. 세 번째 추천은 상대와 무관한 고정 기본 답변(폴백) |
| 35-ssm-apply-phase1-targetnotconnected.png | 개선 A 1단계 `terraform apply`(1 added: SSM 권한) 직후 `start-session` → `TargetNotConnected` | 없음 (계정 ID 없음) | 트러블슈팅: 에이전트가 권한 부여 **전**에 시작해 AccessDenied를 받고 **28분 뒤로 재시도를 미룸** → 에이전트 재시작으로 해결(Online). 새 인스턴스는 정책이 처음부터 붙어 해당 없음 |
| 36-ssm-session-connected-whoami.png | `aws ssm start-session`로 접속 성공, `whoami` → `ssm-user` | 없음 (세션 ID는 일회용) | SSH 키·22번 포트 없이 접속. 개선 A "이후" 핵심 증거 |
| 37-ssm-phase2-apply-ssh-closed.png | 개선 A 2단계 `terraform apply`: `0 added, 1 changed, 0 destroyed` (SG의 22번 규칙 제거) + outputs(`ssm_session` 포함) | 없음 (계정 ID 없음) | 서버 교체 없이 SG만 변경 |
| 38-terraform-no-changes-idempotent.png | 재실행 결과 `No changes. Your infrastructure matches the configuration.` | 없음 | IaC가 수렴했다는 증거(멱등) |
| 39-ssh-timeout-after-ssm.png | `ssh … ec2-user@EIP` → `Connection timed out` | 없음 (Windows 사용자명은 프롬프트에 보임, 허용) | 오늘 겪은 IP 타임아웃이 이번엔 **의도한 결과**. 22번 폐쇄 증거. 터미널의 `PS C:\…\infra>` 경로 노출은 허용 |
| 40-ec2-security-sg-inbound-after.png | 22번 폐쇄 후 SG: 인바운드 **443·80 두 줄**(0.0.0.0/0), 아웃바운드 전체 1줄 | 소유자 ID(계정 ID) 검은 박스 | **12번(3줄, 22번 포함)과 짝**을 이루는 개선 A "이후" 증거 |
| 41-ecr-scan-api-before.png | ECR 스캔(api, 개선 전): 중요 **6** / 높음 **21** / 보통 14 / 낮음 5, 취약성 51건. Critical 의 패키지는 perl·openssl | 없음 (계정 ID 없음) | 개선 B "이전" 증거 (2026-11-12 10:39 스캔) |
| 42-ecr-scan-api-after.png | ECR 스캔(api, 개선 후): 중요 **0** / 높음 **6** / 보통 3 / 낮음 4, 취약성 13건. 남은 High 는 util-linux·glibc·zlib(베이스 OS 패키지) | 없음 | 개선 B "이후" 증거 (15:17 스캔). 크기는 거의 그대로 |
| 43-ecr-scan-web-before.png | ECR 스캔(web, 개선 전): 중요 **21** / 높음 **45** / 보통 8, 취약성 74건. Critical 은 대부분 curl(libcurl 8.19.0-r0)·brotli·zlib | 없음 | 개선 B "이전" 증거 (10:39 스캔) |
| 44-ecr-scan-web-after.png | ECR 스캔(web, 개선 후): 중요 **1**, 나머지 0. 남은 1건은 CVE-2026-4738(zlib 1.3.2-r1) | 없음 | 개선 B "이후" 증거 (15:17 스캔). 같은 CVE 가 개선 전에도 있었고 설명이 gdal(zlib contrib) 제품의 문제라 스캐너의 패키지명 매칭에 의한 오탐일 가능성이 있음(미확정) |
| 45-terraform-destroy-complete.png | `terraform destroy`: 역할 정책 연결·인라인 정책·EIP·인스턴스·인스턴스 프로파일·SG·IAM 역할을 순서대로 삭제, `Destroy complete! Resources: 7 destroyed.` | 없음 (계정 ID 없음, 인스턴스·EIP ID는 삭제된 임시 값) | 의존 순서대로 철거(EIP → 인스턴스 → 프로파일 → SG → 역할) |
| 46-duckdns-domain-deleted.png | DuckDNS `likemelikeme.duckdns.org deleted`, 도메인 0/5 | 없음 (토큰·IP 없음) | 반환된 EIP 를 가리키는 댕글링 DNS 를 막기 위해 철거 직후 삭제 |
| 47-iam-access-key-deleted.png | IAM 사용자 보안 자격 증명: "액세스 키가 삭제됨", **액세스 키 (0)**, MFA(패스키 및 보안 키) 1개 유지 | 식별자 칸 전체(ARN 의 계정 ID·MFA 디바이스 식별자) 검은 박스 | **02번(키 Inactive)과 짝**인 보안 정리 "이후" 증거. 장기 키 없이 MFA 로만 접근 |
| 48-iam-permissions-ecr-only.png | IAM 사용자 권한 정책 (1): `AmazonEC2ContainerRegistryFullAccess`(AWS 관리형, 직접 연결) 하나만 남음 | 없음 (계정 ID·ARN 없음) | AdministratorAccess 를 ECR 전용 최소 권한으로 교체한 "이후" 증거. ECR 삭제 후 이 정책도 제거함(50번) |
| 49-ecr-repositories-deleted.png | ECR 프라이빗 리포지토리 목록: "리포지토리 없음" | 없음 (계정 ID·URI 없음) | 글 작성 후 ECR 이미지·리포지토리 3개를 콘솔에서 삭제한 "이후" 증거 (2026-11-20). 03번과 짝 |
| 50-iam-permissions-removed.png | IAM 사용자 권한 정책 (0): "표시할 리소스 없음" | 없음 (계정 ID·ARN 없음) | 48번(ECR 전용 권한 1개)의 "이후". ECR 삭제 뒤 모든 권한 정책을 제거함. MFA 는 유지(47번) |
| 34-browser-network-relationships-recommendations.png | 수정 후 DevTools: `relationships` **304**(ETag 재검증), `recommendations` **201 / 1.73s**, 콘솔에 요청·응답 로그 | 없음 (JWT는 표준 헤더 접두어만 보임) | RAG+GPT 응답 시간 증거. 노출 주의: `events?token=` URL에 JWT가 쿼리스트링으로 실림(앱 설계상 한계), 운영 번들이 디버그 로그를 출력 |

## 주의

- 04~06은 amd64 이미지 행의 "마지막으로 풀링된 시간 12:03:16"이 EC2의 `compose up` 시각이다.
  같은 줄의 Image Index 행(10:16~10:17)은 배포 전 매니페스트 점검으로 갱신된 값이라 증거로는 쓰지 않는다.
- 태그가 `Image Index`인 것은 buildx가 멀티 플랫폼 인덱스(+증명)로 push했기 때문. ECR 스캔은
  태그가 아니라 amd64 이미지 digest로 해야 한다 (트러블슈팅 소재).
- 의도적으로 제외한 사진: 서버 로그(`docker logs … | grep recommend`)는 UI·DevTools 사진과 증거가 겹치고,
  로그에 **사용자 메시지 본문과 생성된 답변이 평문으로 남는 점**이 오히려 운영 관점의 문제(로그 위생)라서 저장하지 않았다.
- 07번 이전 버전(파라미터 11개)은 텔레그램 정리 전 상태라 폐기했다. 13번은 정리 전 "11개" 시점의 증거로 남아 있다.
