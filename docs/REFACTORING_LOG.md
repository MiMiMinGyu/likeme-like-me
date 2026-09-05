# LikemeLikeMe 리팩토링 로그

> 팀 캡스톤 프로젝트를 개인 포트폴리오 관점에서 **Dockerize → Docker Compose(멀티 컨테이너) → AWS 배포**
> 까지 리팩토링하는 과정 기록. 이 문서는 이후 포트폴리오·기술 블로그(velog) 작성의 1차 자료로 사용한다.
> 형식: **As-Is(기존 상태) → 문제 인식 → To-Be(개선)**.

---

## 현재 진행 상황 (2026-09-06 기준)

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
- **모노레포 초기 정리 PR #1 병합**: `refactor/monorepo-init` → `main` (`821d548`). env 구조,
  DB 점검, tsconfig `baseUrl` 제거, 로그 문서.
- **임베딩 모델 교체 완료** (브리핑 8-3, PR #2 병합 `c098e38`): OpenAI `text-embedding-3-small`(1536) →
  자체 호스팅 `BM-K/KoSimCSE-roberta-multitask`(768). 아래 "임베딩 모델 교체" 섹션 참고.
  `tone_samples` 17,943행 재임베딩 + 질의 경로 교체 + before/after 검증(격리 레벨)까지.

**작업 중 브랜치**: 없음. `main` = `c098e38`. `feat/embedding-kosimcse` 병합·삭제됨.
기능 테스트 세션(2026-09-05~06)에서 나온 수정분은 아직 미커밋 상태 — 아래 "기능 테스트" 섹션 참고.

- **기능 테스트 완료** (2026-09-05~06): ⓐ 앱 부팅 ⓑ auth(JWT, bcrypt) ⓒ 텔레그램 봇 연동
  (실제 텔레그램 데스크탑 앱에서 메시지 송수신 ↔ 로컬 웹 UI가 SSE로 동일 대화를 실시간 반영하는
  화면을 나란히 캡처해 확인) ⓓ `generateReply` end-to-end(KoSimCSE 검색 + GPT) ⓔ `apps/web`
  (React/Vite) 기동까지 전부 확인. 과정에서 UI 버그 1건 + RAG/프롬프트 톤 일관성 버그(5개 원인
  레이어) + dev 서버 orphan 프로세스 반복 이슈를 발견·수정. 상세는 "## 기능 테스트 트러블슈팅" 섹션.

### 다음 세션 시작점 (2026-09-06~)

**기능 테스트 로드맵 1번 항목(ⓐ~ⓔ) 전부 완료.** 이번 세션에서 고친 `llm.service.ts` 변경분
(politeness 필터, 프롬프트 수정)과 `ChatPage.jsx`(자동 스크롤) 변경분은 아직 미커밋 — 다음 세션
시작 시 `git status`로 diff 확인 후 커밋부터 정리.

**컨테이너**: `chatbot_db`, `likeme-embedding` 둘 다 필요. 재부팅했으면 `docker start chatbot_db likeme-embedding`.

**다음 할 일 (우선순위 순)**
1. 이번 세션 변경분 커밋 (`llm.service.ts`, `ChatPage.jsx`) — 커밋 전 diff 재검토.
2. `refactor/env-config`: `apps/api` Joi 검증 스키마 추가(의존성에 `joi` 이미 있음),
   `JWT_SECRET` 등 필수 env 부팅 시 검증 + `|| 'default-secret'` 폴백 제거, `.env.development` 삭제 반영,
   `apps/web/.env.example` 신설. `prisma.config.ts` 이전(에디터 env 오탐 + deprecated 경고 동시 해소).
   `npm ci` 후 자동 빌드되도록 `postinstall` 정리.
3. Dockerfile(백엔드) → `v1-dockerized`
4. 루트 `docker-compose.yml`(백엔드 + DB + **embedding**) → `v2-compose`.
   **주의**: 기존 데이터 볼륨은 `likeme-like-me-api_postgres_data` (아래 트러블슈팅 #1). 새 compose 에서
   `external:` 로 물리거나 `pg_dump`/restore 로 이관. 새 위치에서 그냥 `docker compose up` 하면 빈 볼륨 생성됨.
   `apps/embedding` 서비스도 편입, api 의 `EMBEDDING_URL` 을 서비스명으로.
5. AWS 배포(EC2 또는 ECR) → `v3-aws`

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

## 임베딩 모델 교체 (2026-09-03, 브랜치 `feat/embedding-kosimcse`)

### As-Is
- 말투 검색 RAG 는 `tone_samples` 만 사용 (`message_embeddings`·`knowledge_chunks` 는 스키마만 있고 0행).
- 임베딩: OpenAI `text-embedding-3-small`(1536). `tone_samples` 17,943행 전부 이 벡터로 채워져 있었음.
- 아키텍처: 브리핑엔 "FAISS" 라 돼 있으나 실제는 **pgvector + HNSW**(cosine). FAISS 흔적 없음.
- 검색: [llm.service.ts](../apps/api/src/modules/llm/llm.service.ts) `getSimilarContext` 가 수신 메시지를
  OpenAI 로 임베딩 → `tone_samples` 코사인 top-15. category/politeness/vibe 라벨은 검색에서 미사용
  (프롬프트 텍스트로만 GPT 에 전달).

### 문제 인식
- OpenAI 범용 다국어 임베딩은 "무슨 주제인가"(어휘·표면) 위주로 반응. 이 프로젝트가 필요한 건
  "같은 상황·같은 결의 내 과거 발화" — 한국어 문장 의미/어조 유사도.
- 임베딩마다 외부 API 호출·비용·네트워크 의존.

### To-Be
- **`apps/embedding`** (모노레포 첫 non-Node 앱): FastAPI + transformers + torch(CPU).
  `BM-K/KoSimCSE-roberta-multitask`(768), CLS 풀링 + L2 정규화. `POST /embed`, `GET /health`.
  Dockerfile 에 모델을 구워 기동 즉시화·오프라인.
- **차원 마이그레이션** `20260903120000_embedding_dim_768`: 3개 임베딩 컬럼 `vector(1536)` → `vector(768)`,
  HNSW 인덱스 재생성. `tone_samples` 기존 OpenAI 벡터는 NULL 처리(폐기).
  `migrate dev` 는 기존 이력이 shadow DB 재생 불가라 raw SQL + `migrate resolve` 로 적용
  (트러블슈팅 #1 의 패턴 재사용).
- **재임베딩** `scripts/reembed-tone-samples.ts`: 17,943행 배치 처리, 중단 후 재실행 가능.
  첫 실행이 13,800행에서 컨테이너 OOM(`Exited 137`) → 서비스에 `torch.inference_mode()` +
  주기적 `gc.collect()` + 내부 배치 축소 + 메모리 상한 3g. 재실행으로 전량 완료(약 77초).
- **질의 경로 교체**: `src/modules/embedding/EmbeddingService`(HTTP 클라이언트, 재시도 백오프) 신설 →
  `getSimilarContext`, `kakao.service` 가 이걸 사용. `openai.service` 의 임베딩 메서드는 `@deprecated`
  (분석 스크립트 호환용 잔존). `.env` 에 `EMBEDDING_URL`.

### 검증 — before/after 검색 비교 (동일 쿼리, top-3)

기존 OpenAI 벡터를 백업에서 임시 테이블로 복원해 같은 쿼리로 비교.

| 쿼리 | KoSimCSE 768 (신규) | OpenAI 1536 (기존) |
|---|---|---|
| "내일 시간 되면 잠깐 볼 수 있을까?" | `아 근데 혹시 내일 맞나요?`(.78) / `내일 한 번 더 들어오나요?`(.78) / `그것도 내일 해도 되려나`(.76) — 전부 "내일 약속" 맥락 | `잠깐잠깐 바꿀 수 있느냐고`(.60) / `낮에 대부도 잠깐 갔다올까`(.59) / `잠?`(.57) — "잠깐" 토큰 매칭에 치우침 |
| "자료 언제까지 보내주시면 될까요?" | `언제까지 보내야 되죠?`(.82) / `언제까지 해야 할까요`(.67) — 마감 문의 의도 | `언제까지 보내야 되죠?`(.71) / `자료 뭐 봐요`(.56) / `자료조사 개늦게 해버렸어요`(.49) — "자료" 토큰 |
| "아 그거 진짜 짜증나네" | `그냥 ㅈㄴ 짜증나는데`(.89) / `근데 짜증나잖`(.88) / `그냥 ㅈㄴ 밉다`(.73) — 부정 감정으로 일반화 | `그냥 ㅈㄴ 짜증나는데`(.68) / `이걸 진짜?`(.55) / `와 진짜 개강인가`(.54) — "진짜" 토큰 |

→ KoSimCSE 가 **의도·감정 기준**으로, OpenAI 는 **표면 어휘 기준**으로 검색됨. 절대 유사도도 더 높고 분리가 뚜렷.
전체 체인 1회 확인: 수신 `"내일 시간 되면 잠깐 볼 수 있을까?"` → GPT 답변 `"아, 내일이면 시간 괜찮을 것 같은데요? 몇 시에 만날까요?"` (짧고 자연스러운 반말/존댓말 톤).

### 인지된 한계 (향후 개선)
- 카톡 초단문("굳","넵")은 어느 모델이든 벡터 노이즈. 데이터 특성상 불가피.
- ~~검색이 category/politeness/vibe 라벨을 무시 → 상사에게 답하는데 캐주얼 예시가 뽑힐 수 있음.~~
  **해결 (2026-09-06)**: politeness 버킷 안에서 top-K, 부족하면 전역 폴백으로 구현 완료.
  "## 기능 테스트 트러블슈팅" → "#2. 톤 일관성 버그" 참고.
- 데이터가 CASUAL(13,579) 로 크게 편향, category 10개 중 7개만 사용(교수·집안 어르신은 자동응답
  대상에서 사용자가 의도적으로 제외).
- KoSimCSE 는 2021 RoBERTa-base — 넓은 일반 retrieval 은 최신 대형 모델보다 약할 수 있음.
- 이미지 2.45GB(torch CPU). 필요 시 multi-stage 슬림화.

---

## 기능 테스트 트러블슈팅 (2026-09-05~06)

> 브리핑 8-3(임베딩 교체) 이후 처음으로 앱 전체를 띄워 실제 흐름(웹 UI → API → GPT)을 돌려본 세션.
> 앱은 첫 시도에 별다른 수정 없이 부팅에 성공했지만, 실제 대화 흐름을 테스트하는 과정에서
> UI 버그 1건과 다층적인 톤 일관성 버그, 그리고 개발 환경 자체의 반복적인 문제를 발견했다.

### #1. AI 추천 답변 박스가 채팅창을 가리는 UI 버그

**As-Is / 증상**: `.messagesContainer`는 `flex:1; overflow-y:auto`라 AI 추천 답변 박스가 나타나면
채팅창 높이 자체는 정상적으로 줄어드는데(레이어가 겹치는 게 아님), 스크롤 위치를 맞춰주는 로직이
없어서 방금 온 메시지가 시야 아래로 밀려 사용자가 매번 수동 스크롤을 해야 했다.

**To-Be**: `.messagesContainer`에 `ref`를 연결하고 `messages`/`recommendations`/`recommendationLoading`이
바뀔 때마다 `scrollTop = scrollHeight`로 바닥까지 자동 스크롤하는 `useEffect` 추가.
([ChatPage.jsx](../apps/web/src/pages/chat/ChatPage.jsx))

### #2. 톤 일관성 버그 — "겉보기엔 하나, 실제론 다섯 겹" 원인

**증상**: 존댓말 관계(민수, `politeness=POLITE`)에게 보낼 AI 추천 답변 중 **부정(거절) 답변만** 반말이
섞이거나("오늘은 힘들어 형님 다음에 하자"), 시제가 어긋나는(월요일 약속 얘기 중인데 "오늘은 바빠서"라고
답하는) 문제가 반복됨. 원인을 하나씩 벗겨내는 과정 자체가 이 세션의 핵심 트러블슈팅이었다.

**원인 레이어 (발견 순서대로)**

| # | 레이어 | 실제 원인 | 조치 |
|---|---|---|---|
| 1 | RAG 검색 | `getSimilarContext`가 politeness/category 라벨을 무시하고 전체 톤샘플에서 순수 텍스트 유사도로만 top-15 검색 → 존댓말 상대인데 다른 반말 상대(동생·친구)의 예시가 대거 섞여 들어옴 | politeness 버킷 우선 검색 + 부족분 전역 폴백 (`getSimilarContext(... , politeness)`) |
| 2 | Prisma 쿼리 버그 | 폴백 쿼리의 `id NOT IN (...)` 에서 `uuid <> text` 캐스팅 에러 (`42883`) | `id::text NOT IN (...)`로 캐스팅 |
| 3 | 프롬프트 지시 부재 | "관계에 맞는 격식 수준 유지"라는 추상적 지시만 있어 LLM이 예시 텍스트의 반말 어미에 끌려감 | `politenessInstruction()` 추가 — "반드시 존댓말/반말로 답변할 것" 명령형 지시 |
| 4 | LLM 관용구 편향처럼 보였던 것 | "다음에 하자" 류 거절+재약속 관용구가 반말로 워낙 강하게 학습돼 추상적 금지를 이김 (것처럼 보임) | `declineExample()` — politeness별 전체 문장 예시를 지시 바로 옆에 배치 |
| 5 | **진짜 원인 (반전)** | 계정에 저장된 `custom_guidelines`(말투 커스텀 규칙) 5번이 `'다음에 하자'/'오늘은 힘들어'`를 관계 존댓말과 무관하게 하드코딩된 대안 문구로 명시 — `customGuidelines`가 있으면 `defaultConstraints` 전체가 무시되므로, 1~4번 수정이 전혀 안 먹히고 있었음 | 저장된 `custom_guidelines` 텍스트 자체를 존댓말/반말 상대를 구분하는 조건부 문구로 수정 (DB 직접 업데이트) |
| 6 | 자기모순 예시 | 5번을 고친 뒤에도 "오늘"이 계속 나옴 → `declineExample()`에 내가 넣은 예시 문구 자체가 `"오늘은 조금 힘들어요, 다음에 해요"`였고, "형식만 참고하라"고 적어도 LLM이 내용까지 거의 그대로 베낌. 동시에 다른 곳엔 "오늘 쓰지 말라"는 지시를 넣어 자기모순이었음 | 예시에서 시간 표현 제거 (`"그건 조금 어려울 것 같아요, 다음에 해요"`) |

**교훈**: 4번(LLM 관용구 편향)은 그럴듯한 가설이었지만 틀렸다 — 실제로는 코드가 아니라 **DB에 저장된
설정 데이터**가 원인이었다. `customGuidelines ? A : B` 같은 이분기 구조에서는, 코드를 아무리 고쳐도
분기 A(사용자 데이터)가 쓰이는 한 분기 B(내가 고친 기본값)의 수정은 눈에 보이는 효과가 없다 —
디버그 로그로 **실제로 LLM에 전송되는 완전한 프롬프트**를 까보고 나서야 발견함.

**검증 — 같은 쿼리("월요일 밥 약속" 흐름 중 "중국음식 배달시켜 먹을까?") 반복 테스트**

| 구분 | 수정 전 | 레이어 1~4 수정 후 | 레이어 5~6 수정 후 (최종) |
|---|---|---|---|
| 긍정 답변 | 존댓말 (우연히 일치) | 존댓말, 일관됨 | 존댓말, 일관됨 |
| 부정 답변 어체 | 반말 혼입 ("형님 다음에 하자") | 존댓말이지만 매번 거의 동일한 문장 | 존댓말, 시제 정합 |
| 시제 | "오늘은 바빠서" (미래 약속인데 현재형) | "오늘은 조금 힘들어요" (동일 문제 잔존) | "그건 조금 어려울 것 같아요" (시점 언급 제거) |
| 근본 원인 | (미상) | RAG 편향 + 프롬프트 지시 부재로 오판 | 실제로는 계정 `custom_guidelines` 데이터 |

**politeness 버킷 검색 효과 (DB 직접 재현, `tone_samples` 전수 재쿼리)**

| 쿼리 | 필터 없음 (top-15) | politeness=POLITE 필터 적용 |
|---|---|---|
| "응 개강했지 돌아오는 월요일에 같이 밥 먹을까?" | POLITE 3 / CASUAL 12 | POLITE 15 (폴백 불필요) |
| "중국음식 배달시켜 먹을까?" | POLITE 다수지만 라벨 무시 상태로 검색 | POLITE 13 + 전역 폴백 2 |

사용자(민수 관계, `politeness=POLITE`) 톤샘플 전체 분포: `POLITE 4,112개 / CASUAL 13,579개 / FORMAL 252개`
— POLITE 데이터 자체는 충분해서, 필터링 안 하는 것 자체가 손해였음을 보여주는 근거.

### #3. dev 서버 `--watch` 재시작 시 반복되는 EADDRINUSE (orphan 프로세스)

**증상**: 코드 저장 → `nest --watch`가 재컴파일·재시작 → `Nest application successfully started` 직후
`Error: listen EADDRINUSE :::3000`. 터미널에서 `Ctrl+C` 후 재기동해도 동일 에러 반복 (세션 중 3회 발생).

**원인**: Windows에서 `@nestjs/cli --watch`가 이전 워커 프로세스를 완전히 죽이기 전에 새 워커를 띄우는
레이스 컨디션. 죽지 않은 이전 `node.exe`가 포트를 계속 점유 → 새 프로세스는 애플리케이션 초기화까지는
성공하지만 실제 HTTP 바인딩에서 실패. 게다가 이 orphan은 터미널의 `Ctrl+C`(SIGINT)를 받지 못해
사용자가 재기동해도 안 죽음.

**조치**: 매번 `netstat -ano | findstr :3000` 으로 실제 포트 점유 PID 확인 → `taskkill /PID <pid> /F` 로
강제 종료 후 재기동. 근본 해결책(예: `npx kill-port 3000 && npm run start:dev`를 `predev` 스크립트로 등록)은
아직 미적용 — 재발 시 다시 수동 처리 필요.

### #4. 텔레그램 연동 end-to-end 확인

로컬 웹 UI(`localhost:5173`)와 텔레그램 데스크탑 앱(Telegram Web, `@LikeMe_bot`)을 나란히 띄워
동일 대화가 양쪽에 실시간으로 동일하게 반영되는 것을 화면 캡처로 확인. 텔레그램 앱에서 보낸
메시지가 webhook → SSE로 웹 UI에 즉시 뜨고, 웹 UI에서 만든 이전 대화 기록(예: "좋아요 형님 같이
밥 먹어요 월요일에 뭐 먹을까요?")도 텔레그램 쪽 대화창에 동일하게 남아 있어, 수신·AI 추천·
**실제 전송**(`TelegramService.sendSelectedReply` → `bot.telegram.sendMessage`)까지 전체 루프가
실제 텔레그램 계정으로 왕복 확인됨. 포트폴리오용으로 남겨둘 만한 스크린샷.

---

## 참고
- 원본 팀 저장소: `github.com/MiMiMinGyu/Capstone2_BE`, `github.com/MiMiMinGyu/Capstone2_FE` (public)
- 로컬 백업: `c:\Users\awing\projects\academic\likemelikeme-backup.zip`, 원본 폴더
  `likeme-like-me-api/`, `likeme-like-me-web/` (그대로 보존, 삭제는 사용자 판단)
- 브리핑 원문: `likemelikeme-project-briefing.md` (사용자 보유)
- 스택: NestJS 11 / Prisma / PostgreSQL+pgvector / OpenAI / Telegram(telegraf) / JWT / (Redis 캐시는 미도입) · React 19 / Vite 7
