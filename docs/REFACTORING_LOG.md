# LikemeLikeMe 리팩토링 로그

> 팀 캡스톤 프로젝트를 개인 포트폴리오 관점에서 **Dockerize → Docker Compose(멀티 컨테이너) → AWS 배포**
> 까지 리팩토링하는 과정 기록. 이 문서는 이후 포트폴리오·기술 블로그(velog) 작성의 1차 자료로 사용한다.
> 형식: **As-Is(기존 상태) → 문제 인식 → To-Be(개선)**.

---

## 현재 진행 상황 (2026-09-03 기준)

**완료**
- 모노레포 통합: 팀에서 분리 운영하던 FE/BE 두 저장소(`Capstone2_FE`, `Capstone2_BE`)의
  `main` 트리를 단일 저장소 `apps/web` + `apps/api` 로 통합
- `git init` → 첫 커밋 `413edd9` `chore: LikemeLikeMe 원본 캡스톤 상태 스냅샷` → 태그 **`v0-original`**
- 원격: **private** 저장소 `https://github.com/MiMiMinGyu/likeme-like-me` 에 `main` + `v0-original` push 완료
- 루트 `.gitignore` 통합(비밀값 커밋 차단 규칙 강화), 루트 `README.md` 추가
- 보안 스캔: 팀 public 레포 히스토리에서 **텔레그램 봇 토큰 노출** 발견 → 사용자가 @BotFather `/revoke` 완료
- env 구조 정리 방향 확정 (아래 "환경변수" 항목)

**작업 중 브랜치**: `refactor/monorepo-init` (아직 커밋 안 됨, 변경분: `apps/api/.env.example` 최신화)

**다음 할 일 (우선순위 순)**
1. `refactor/monorepo-init` 의 `.env.example` 변경 커밋 → PR → `main` 병합
2. **텔레그램 봇 토큰 교체 반영**: @BotFather 새 토큰을 `apps/api/.env` 에 기입 (revoke 완료됨)
3. **GPT API 키 본인 명의 재발급** + `apps/api/.env` 반영 + OpenAI usage limit 설정 (브리핑 8-1)
4. **DB 연결 점검** (브리핑 8-2 = 로드맵 5단계 실습): `docker compose up` 으로 postgres 띄우고
   Prisma 연결 확인, 트러블슈팅 기록
5. **임베딩 모델 교체** (브리핑 8-3, ~하루 타임박스):
   OpenAI 임베딩 → `BM-K/KoSimCSE-roberta-multitask`, 벡터 1,546개 재임베딩, FAISS 인덱스 재구성,
   GPT 프롬프트 연결까지만. 완벽 안 해도 됨 — "한계 + 향후 개선 방향"으로 기록
6. `refactor/env-config`: `apps/api` Joi 검증 스키마 추가(의존성에 `joi` 이미 있음), `.env.development` 삭제 반영,
   `apps/web/.env.example` 신설
7. Dockerfile(백엔드) → `v1-dockerized`
8. 루트 `docker-compose.yml`(백엔드 + DB) → `v2-compose`
9. AWS 배포(EC2 또는 ECR) → `v3-aws`

---

## 확정된 결정 사항

| # | 결정 | 근거 |
|---|---|---|
| 저장소 구조 | **모노레포** (`apps/api` + `apps/web` + 루트 compose) | 1인 풀스택 유지보수 + 단일 배포 단위 + 포트폴리오 링크 하나 + 리팩토링 서사를 하나의 git log 에 |
| 원격 | 본인 계정 **신규 private** 레포 (`MiMiMinGyu/likeme-like-me`) | 팀 공용 레포에 개인 작업 섞지 않음. 정리 후 public 전환 예정 |
| 히스토리 | 원본 스냅샷 1커밋 + `v0-original` 태그부터 선형 | 팀 상세 히스토리는 원본 팀 레포·백업 zip 에 보존. before/after 가독성 |
| 스냅샷 기준 | 양쪽 레포 `main` | API `feat/refactoring` 의 `ceb2166`(Redis 캐시 + 임베딩 시각화)는 8개월 갭·영문 커밋·미완성·`LLMy` 오타 포함 → 팀 산출물 아님. Redis 캐싱은 나중에 독립 리팩토링 단계로 제대로 재도입 |
| 브랜치 전략 | **GitHub Flow** + `refactor/*` `feat/*` `fix/*` `chore/*` `docs/*`, Conventional Commits, 마일스톤 태그 | Git Flow 는 이 규모에 과함 |

---

## 환경변수 (env) 정리 방향

**As-Is**
- `apps/api`: `.env`, `.env.development`, `.env.example` 3개 존재
- `app.module.ts` 가 `envFilePath: '.env'` 하드코딩 → **`.env.development` 는 죽은 파일** (아무도 안 읽음)
- `.env.example` 이 오래됨: `JWT_SECRET`, `OPENAI_API_KEY`, `DEFAULT_USER_ID` 등 실제 필요한 키 누락
- `apps/web`: `.env.development` 만 존재하고 **git 추적됨** (내용은 `VITE_API_BASE_URL=http://localhost:3000` — 비밀 아님)
- web `.gitignore` 에 `.env` 관련 규칙 없음

**문제 인식**
- 비밀값(JWT/OpenAI/Telegram)이 배포 환경에 하드코딩·파일 의존 → Secrets 분리 필요 (브리핑 3)
- per-env 파일 분리 의도만 있고 wiring 안 됨 → 혼란만 유발
- 배포 타깃이 Docker/AWS → 설정은 파일이 아니라 주입으로 받아야 함

**To-Be**
- **api**: `.env`(gitignore, 로컬 dev 전용) + `.env.example`(모든 필수 키 + placeholder) 만. `.env.development` 삭제.
  배포 시 Compose `environment:` / AWS Secrets Manager 주입. `joi` 로 부팅 시 env 검증.
- **web**: `.env.development`(커밋, 비밀 아님, 클론 시 동작하는 기본값) + `.env.production`(추후, 배포 URL) + `.env.example`.
  Vite 는 per-mode 파일을 네이티브로 로드하므로 이 구조가 관례에 맞음.
- **원칙**: "파일명 통일"이 아니라 **"비밀은 gitignore, 공개 빌드 설정은 커밋 가능"**. api ≠ web 이어도 됨.
- 이미 반영: `apps/api/.env.example` 최신화 (JWT/OpenAI/DEFAULT_USER_ID 키 + 주석 추가). `.env.development` 는
  사용자가 수동 삭제함.

---

## 보안 이슈 기록

### 텔레그램 봇 토큰 노출 (팀 public 레포)
- **As-Is**: `Capstone2_BE` 의 `.env.example` 에 실제 봇 토큰이 커밋됨 (커밋 `e53cb4f`, `7c0ad20` 등).
  이후 `b7ce5f9` 에서 placeholder 로 교체했으나 git 히스토리에 잔존, `main` 포함, public.
  현재 로컬 `.env` 에서 실제 사용 중인 토큰과 동일했음.
- **조치**: 사용자가 @BotFather `/revoke` 로 토큰 재발급 완료 → 노출된 옛 토큰 무효화.
  히스토리 정리(`git filter-repo`)는 팀원 협의 필요, revoke 로 급한 위험은 해소되어 후순위.
- **신규 모노레포**: `apps/api/.env.example` 는 placeholder 만 포함 (확인 완료). 깨끗함.

### OpenAI 키
- 팀 레포 히스토리에 **실제 키 없음** (placeholder `sk-...` 만). `.env` 는 커밋된 적 없음.
- 로컬 `apps/api/.env` 에 팀원 명의 `sk-proj-...` 키 존재 → 어차피 본인 키로 교체 대상(8-1). 교체 시 삭제.

---

## 참고
- 원본 팀 저장소: `github.com/MiMiMinGyu/Capstone2_BE`, `github.com/MiMiMinGyu/Capstone2_FE` (public)
- 로컬 백업: `c:\Users\awing\projects\academic\likemelikeme-backup.zip`, 원본 폴더
  `likeme-like-me-api/`, `likeme-like-me-web/` (그대로 보존, 삭제는 사용자 판단)
- 브리핑 원문: `likemelikeme-project-briefing.md` (사용자 보유)
- 스택: NestJS 11 / Prisma / PostgreSQL+pgvector / OpenAI / Telegram(telegraf) / JWT / (Redis 캐시는 미도입) · React 19 / Vite 7
