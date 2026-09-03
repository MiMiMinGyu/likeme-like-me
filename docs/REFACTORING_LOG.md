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
- **텔레그램 봇 토큰 교체 반영**: @BotFather 새 토큰을 `apps/api/.env` 에 기입 완료
- **GPT API 키 본인 명의 재발급 완료**: 본인 OpenAI 계정에서 프로젝트 키(`sk-proj-...`) 생성 →
  `apps/api/.env` 의 `OPENAI_API_KEY` 교체, 팀원 명의 키 제거. Permissions 는 `Restricted` →
  Model capabilities `Request` 만 허용. 결제는 **선불 크레딧 $5 + auto-reload OFF** 로 사실상 상한 고정
  (별도 usage limit 설정은 생략 — 크레딧 소진 시 API 가 429 로 멈춤). 팀원에게 기존 키 revoke 요청 전달 필요.
- **`JWT_SECRET` 재생성**: `crypto.randomBytes(48).toString('base64')` 로 랜덤값 생성해 `apps/api/.env` 반영
  (기존엔 추측 가능한 값 → HMAC 서명 키 위조 = 인증 우회 위험이었음).
- **DB 연결 점검 완료** (로드맵 5단계 실습): 아래 "트러블슈팅 기록 #1" 참고. `chatbot_db` 컨테이너 복구,
  Prisma 마이그레이션 이력 정리(`migrate deploy` → `Database schema is up to date!`),
  `DEFAULT_USER_ID` 가 `apps/api/.env` 값과 일치함 확인.

**작업 중 브랜치**: `refactor/monorepo-init` — 로컬 커밋 2개(`4583f1f` docs 로그, `2ad69d1` `.env.example` 최신화).
아직 push·PR 안 됨.

**다음 할 일 (우선순위 순)**
1. `refactor/monorepo-init` push → PR → `main` 병합 (커밋 2개: docs 로그 + `.env.example`)
2. **임베딩 모델 교체** (브리핑 8-3, 타임박스 사용자가 3~4일로 확장):
   OpenAI `text-embedding-3-small`(1536) → `BM-K/KoSimCSE-roberta-multitask`(768).
   `tone_samples` **17,943행 전부** 재임베딩 (현재 전 행에 OpenAI 벡터가 채워져 있음 — 폐기 대상).
   질의 시점 임베딩([llm.service.ts](../apps/api/src/modules/llm/llm.service.ts) `getSimilarContext`,
   [kakao.service.ts](../apps/api/src/modules/kakao/kakao.service.ts))도 같은 모델로 교체해야 벡터 공간 일치.
   GPT 프롬프트 연결까지만. 완벽 안 해도 됨 — "한계 + 향후 개선 방향"으로 기록.
   **선행 필요**: `tone_samples.embedding` NULL 처리 → 컬럼 `vector(1536)` → `vector(768)` 마이그레이션
   + HNSW 인덱스(`idx_tone_samples_embedding`) 재생성. `knowledge_chunks`·`message_embeddings` 는 0행이라 무손실.
3. `refactor/env-config`: `apps/api` Joi 검증 스키마 추가(의존성에 `joi` 이미 있음),
   `JWT_SECRET` 등 필수 env 부팅 시 검증 + `|| 'default-secret'` 폴백 제거, `.env.development` 삭제 반영,
   `apps/web/.env.example` 신설
4. Dockerfile(백엔드) → `v1-dockerized`
5. 루트 `docker-compose.yml`(백엔드 + DB) → `v2-compose`.
   **주의**: 기존 데이터 볼륨은 `likeme-like-me-api_postgres_data` (아래 트러블슈팅 #1). 새 compose 에서
   `external:` 로 물리거나 `pg_dump`/restore 로 이관. 새 위치에서 그냥 `docker compose up` 하면 빈 볼륨 생성됨.
6. AWS 배포(EC2 또는 ECR) → `v3-aws`

**미결 / 나중에**
- `npm audit`: `apps/api` 에 취약점 51개(critical 2) — 8개월 된 의존성 트리의 transitive. 로컬 개발 단계라 급하지 않음.
  `npm audit fix --force` 금지(고정 버전 깨짐). 별도 `chore(deps)` 로 개별 처리.
- npm 11 의 install-script 차단: `bcrypt` 네이티브 빌드, `@prisma/client` 의 `prisma generate` postinstall 이 안 됨.
  → `npx prisma generate` 는 수동 실행해 둠(클라이언트에 enum 누락으로 `tsc` 실패하던 것 해소).
  앱 부팅 전 `npm approve-scripts bcrypt @swc/core @prisma/client @prisma/engines prisma` + `npm rebuild bcrypt` 필요.
  `npm ci` 로 새로 설치하면 다시 재현되므로 3번(env-config)에서 `postinstall` 스크립트 정리와 함께 처리.
- `package.json#prisma` 설정 deprecated (Prisma 7 에서 제거) → `prisma.config.ts` 이전은 3번 또는 별도 chore.
- Prisma 를 `8.0.0-rc` 로 올리라는 알림이 뜨지만 무시 (npm `latest` 태그가 현재 RC 를 가리킴). `^6.18.0` 유지.

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
- 로컬 `apps/api/.env` 에 팀원 명의 `sk-proj-...` 키 존재했음 → 본인 키로 교체 완료(8-1). 팀원에게 옛 키 revoke 요청 전달 필요.

---

## 트러블슈팅 기록

### #1. DB 연결 끊김 → 컨테이너·볼륨·의존성 복구 (로드맵 5단계 실습, 2026-09-03)

**As-Is / 증상**
- DBeaver 로 `chatbot_db` 접속 시 "Connection to 'chatbot_db' was lost and cannot be re-established".
- 코드를 모노레포로 옮기고 API 키를 바꾸는 과정에서 틀어졌다고 추정했으나, 실제 원인은 그것과 무관.

**문제 인식 (단계별로 드러난 원인)**
1. **Docker Desktop 자체가 꺼져 있었음** (`docker` 명령이 파이프 에러). → 실행.
2. `docker ps -a`: `chatbot_db` 컨테이너가 `Exited (0) 9 months ago`. 종료 코드 0 = 정상 종료(크래시 아님).
   9개월 전 Docker Desktop 종료와 함께 멈췄고, `restart: unless-stopped` 정책상 수동 종료로 간주돼 자동 재시작 안 됨.
3. `docker inspect chatbot_db`: 이 컨테이너는 **예전 경로**
   `c:\Users\awing\likeme-like-me-api\docker-compose.yml` 에서 생성됨(compose 프로젝트명 `likeme-like-me-api`),
   데이터 볼륨은 **`likeme-like-me-api_postgres_data`**.
   → 지금 위치(`.../likemelikeme/apps/api`)에서 `docker compose up` 을 하면 compose 가 프로젝트명을 `api` 로 잡아
   **새 빈 볼륨 `api_postgres_data`** 를 만들어 붙임 → 데이터가 사라진 것처럼 보이는 함정.
4. `apps/api/node_modules` 없음 — 코드 이동 후 `npm install` 미실행. `npx prisma` 가 로컬에 CLI 가 없어
   원격에서 `prisma@8.0.0-rc.12`(릴리스 후보!)를 받으려 함. package.json 은 `^6.18.0` 고정.
5. npm 11.16 의 **install-script 기본 차단** 기능: `bcrypt`, `@swc/core` 등 7개 패키지의 네이티브 빌드/postinstall
   미실행 (`npm approve-scripts` 필요). Prisma 엔진 바이너리는 패키지에 동봉돼 있어 영향 없었음.
6. `prisma migrate status`: 마이그레이션 2개(`20251201_add_text_search`, `20251201_fix_korean_search`)가
   "미적용"으로 표시. 그러나 `\d tone_samples` 확인 시 해당 컬럼/인덱스/트리거가 **이미 DB 에 존재** →
   과거에 `psql`/`db push` 로 수동 적용돼 `_prisma_migrations` 이력만 누락된 상태.

**To-Be / 조치**
- `docker start chatbot_db` — 기존 컨테이너·볼륨 그대로 재기동 (데이터 보존). `docker compose up` 을 새 위치에서
  돌리지 않음.
- `cd apps/api && npm install` — `prisma@6.18.0` 등 로컬 설치. `package-lock.json` 변화 없음(트리 일치).
- `npx prisma migrate deploy` — 두 마이그레이션 SQL 이 전부 멱등(`IF NOT EXISTS`, `CREATE OR REPLACE`,
  `DROP ... IF EXISTS`)이라 재실행해도 안전. `_prisma_migrations` 이력 정리 + `text_search_vector` 를
  최종본(한국어 char-split)으로 재계산. → `Database schema is up to date!`
- `DEFAULT_USER_ID`: `SELECT id, email FROM users;` 결과가 `apps/api/.env` 값과 일치 → 수정 불필요.

**확인된 데이터 상태 (이 볼륨 기준)**
- `tone_samples` = 17,943행 (말투 학습 코퍼스, 온전) · `messages` = 53행 (텔레그램 테스트)
- `knowledge_chunks` = 0 · `message_embeddings` = 0 → **벡터 인덱스는 비어 있음**.
  브리핑의 "벡터 1,546개"는 이 볼륨에 없음. 5번(임베딩 교체)에서 `tone_samples` 기준으로 새로 생성.

**아키텍처 정정 (브리핑 ≠ 실제 코드)**
- 브리핑은 "FAISS + PostgreSQL" 이라 했으나, `main` 코드에 FAISS 인덱스 파일·라이브러리 흔적 없음.
  마이그레이션 `add_hnsw_indexes_on_vectors` 존재 → **벡터 검색은 Postgres pgvector + HNSW 인덱스로만** 수행.
  브리핑 8-3 의 "FAISS 인덱스 재구성"은 실제로는 "pgvector 테이블 재적재"(인덱스는 자동).
- 임베딩 컬럼 3개(`tone_samples`, `knowledge_chunks`, `message_embeddings` 의 `embedding`)가
  **`vector(1536)`** 하드코딩(OpenAI `text-embedding-3-small` 차원). `BM-K/KoSimCSE-roberta-multitask` 는
  **768차원** → 5번에서 `vector(768)` 마이그레이션 + HNSW 인덱스 재생성 필요. 현재 임베딩 행 0 이라 무손실.

**로드맵 8단계(루트 compose)로 넘길 것**
- 폴더 이동으로 compose 프로젝트명이 바뀌어 기존 볼륨과 어긋나는 문제. 새 루트 `docker-compose.yml` 에서
  `likeme-like-me-api_postgres_data` 를 `external: true` 볼륨으로 선언하거나, `pg_dump` → 새 볼륨 restore.

---

## 참고
- 원본 팀 저장소: `github.com/MiMiMinGyu/Capstone2_BE`, `github.com/MiMiMinGyu/Capstone2_FE` (public)
- 로컬 백업: `c:\Users\awing\projects\academic\likemelikeme-backup.zip`, 원본 폴더
  `likeme-like-me-api/`, `likeme-like-me-web/` (그대로 보존, 삭제는 사용자 판단)
- 브리핑 원문: `likemelikeme-project-briefing.md` (사용자 보유)
- 스택: NestJS 11 / Prisma / PostgreSQL+pgvector / OpenAI / Telegram(telegraf) / JWT / (Redis 캐시는 미도입) · React 19 / Vite 7
