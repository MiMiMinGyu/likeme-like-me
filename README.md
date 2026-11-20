# LikemeLikeMe

메신저로 연락이 온 상대의 지난 대화를 참고해, 본인 말투를 학습한 LLM이 적절한 답변 후보를
생성하는 RAG 기반 캡스톤 프로젝트. 운동이나 운전처럼 직접 답장하기 어려운 상황에서 휴대폰으로
클릭 한 번에 AI가 만든 답장을 보내는 것이 목표였다.

팀 캡스톤으로 끝낸 프로젝트를 **혼자 다시 열어** Docker → Docker Compose → AWS 배포까지
리팩토링했다. 이 저장소에서 보여 주려는 것은 앱의 말투 재현 품질이 아니라,
**끝난 프로젝트를 인수해 운영 가능한 상태로 옮기는 과정과 그 과정의 판단·사고 기록**이다.

- **backend** — NestJS 11, Prisma, PostgreSQL + pgvector, OpenAI, Telegram(telegraf), JWT
- **embedding** — KoSimCSE(`BM-K/KoSimCSE-roberta-multitask`, 768차원) 자체 호스팅 서비스 (FastAPI)
- **frontend** — React 19, Vite 7, React Router 7, axios
- **proxy** — Caddy (SPA 서빙 + API 프록시 + Let's Encrypt 자동 HTTPS)

## 글 모음

재배포 과정에서 겪은 문제와 되돌아본 내용을 글로 정리했다. 시간순이며, 마지막 회고는 앞선 글을 읽지 않아도 읽을 수 있다.

| 글 | 내용 |
|---|---|
| [깨끗한 DB에서 만난 Prisma 마이그레이션 오류](docs/blog/01-migration-replay.md) | 빈 DB에서 마이그레이션을 처음부터 적용하자 4번째에서 실패한 오류(P3018)와 수정 |
| [Caddy 라우팅과 브라우저 캐시](docs/blog/02-caddy-routing-cache.md) | `/relationships`가 API로 전달되지 않은 원인(Caddy 경로 매칭)과, 수정 뒤에도 증상이 남은 브라우저 캐시 |
| [SSH 타임아웃에서 SSM Session Manager 전환까지](docs/blog/03-ssh-to-ssm.md) | 공인 IP가 바뀌어 SSH가 막힌 일, SSM으로 접속 방식을 바꾸고 22번 포트를 닫은 과정 |
| [회고 - 모델 선정부터 AWS 배포까지](docs/blog/04-retrospective.md) | 캡스톤 때의 모델 선정과 이번 재배포를 나란히 놓고 되짚은 글 |

## 현재 상태

- **AWS 배포는 2026-11-12 에 실제로 수행하고 증거를 남긴 뒤 모두 철거했다.** 지금은 접속 가능한 서버가 없다.
  시연 대신 [배포 증거 스크린샷](docs/evidence/README.md)(50장, 계정 ID 등은 가린 사본)과
  [배포 기록](docs/REFACTORING_LOG.md)으로 확인할 수 있다.
- 로컬에서는 `docker compose up --build` 로 전체 스택이 뜬다 (아래 "로컬 실행").
- **한계를 먼저 밝힌다.**
  - 2025년 2학기 캡스톤 디자인2에서 처음에는 오픈소스 LLM(`llama-3.2-Korean-Bllossom-3B`)을 AI Hub 데이터와
    드라마 대본 등으로 전처리·학습시켜, 일반 대화로 다양한 말투를 익힌 모델에 사용자의 카카오톡 대화(txt)를 DB로 더해
    개인 말투에 맞는 응답을 만들려 했다. 그러나 모델이 학습한 것은 말투가 아니라 대화 내용에 가까웠고, 응답의 말투는
    모델 고유의 말투에 머물렀다. FAISS·RAG 등을 시도한 끝에 완성된 GPT 모델 + RAG 구성으로 마무리했다.
  - 여기서 다루는 것은 앱의 기능이나 말투 품질이 아니라, 종료된 프로젝트를 다시 열어 리팩토링·컨테이너화·배포하며
    얻은 것이다. 모델 선정 기준, 무엇이 문제였고 지금이라면 어떻게 했을지는 [회고 글](docs/blog/04-retrospective.md)에서 정리한다.
  - 배포는 단일 EC2 + `docker compose` 의 최소 구성이다(RDS·ALB·ECS 없음). 이유와 운영 환경에서의 대안은
    [REFACTORING_LOG](docs/REFACTORING_LOG.md) 의 "운영 환경이라면" 에 정리했다.
  - 알려진 보안·품질 후속 과제(객체 수준 권한 검사, 공개 엔드포인트, 디버그 로그 등)는
    [REFACTORING_LOG](docs/REFACTORING_LOG.md) 의 "이번에 고치지 않은 것" 에 남겼다.

## 아키텍처 (AWS 배포 시)

```
인터넷 :80/:443 ──► EC2 (t3.small, SG: 80·443 만 열림, 접속은 SSM Session Manager)
                      docker compose
                      ├─ web (Caddy)  : SPA + API 프록시 + 자동 HTTPS
                      ├─ api (NestJS) : 시작 시 prisma migrate deploy
                      ├─ embedding    : KoSimCSE 768 (내부 전용)
                      └─ db (pgvector): 볼륨 (내부 전용)
        ECR (이미지 pull) · SSM Parameter Store (시크릿 → EC2 의 .env) · OpenAI (outbound)
```

## 저장소 구조

```
likemelikeme/
├── apps/
│   ├── api/         # NestJS 백엔드 (구 likeme-like-me-api)
│   ├── web/         # React 프론트엔드 + Caddyfile (구 likeme-like-me-web)
│   └── embedding/   # KoSimCSE 임베딩 서비스 (FastAPI, Python)
├── infra/           # Terraform (EC2 + EIP + SG + IAM, SSM 접속)
├── scripts/         # 시크릿 주입(SSM) · 데이터 이관 스크립트
├── docs/            # 배포 런북 · 리팩토링 로그 · 증거 스크린샷 · 글
├── docker-compose.yml            # 내부 전용 베이스 (db + embedding + api + web)
├── docker-compose.override.yml   # 개발용(포트 노출), 자동 적용
└── docker-compose.prod.yml       # 운영용(ECR 이미지, 80/443 만 노출)
```

원래 팀 프로젝트에서는 분업/협업을 위해 프론트엔드와 백엔드를 **분리된 두 저장소**
(`Capstone2_FE`, `Capstone2_BE`)로 운영했다. 개인 리팩토링 단계에서 전체를 **하나의
배포 단위**로 다루기 위해 모노레포로 통합했다. 각 앱의 팀 커밋 히스토리는 원본 팀 저장소(현재 비공개)에
그대로 보존되어 있으며, 이 저장소는 `v0-original` 태그를 기준선으로 리팩토링 이력만 선형으로 쌓는다.

## 리팩토링 로드맵

| 태그 | 내용 |
|------|------|
| `v0-original` | 원본 캡스톤 상태 스냅샷 (FE/BE 통합) |
| `v1-dockerized` | 백엔드 Dockerfile 작성 · 이미지 빌드 |
| `v2-compose` | 백엔드 + DB + 임베딩 멀티 컨테이너 (Docker Compose) |
| `v3-aws` | AWS 배포 **준비** 완료 (digest 핀 · Caddy · dev/prod compose · SSM · Terraform) |
| `v3-aws-deployed` | AWS 배포 **실행·검증·철거** 완료 (SSM 접속 전환, 마이그레이션 재현성, 라우팅 수정 반영) |

태그는 각 단계를 끝낸 시점의 코드를 가리키는 고정된 이름표다. 단계 사이의 차이는
GitHub 의 compare 화면(예: `.../compare/v2-compose...v3-aws-deployed`)으로 볼 수 있다.

### 주요 리팩토링 항목

- GPT API 키를 팀원 개인 키 → 본인 키로 교체, 노출된 토큰 폐기·재발급, `.env` / SSM 분리
- 임베딩 모델 교체 (OpenAI `text-embedding-3-small` → 자체 호스팅 KoSimCSE) 와 전후 비교
- 환경변수 부팅 검증(Joi), 하드코딩 제거
- Dockerfile(멀티스테이지) → Docker Compose(dev/prod 분리) → 단일 EC2 배포(Terraform)
- 배포에서 처음 드러난 문제의 수정: 마이그레이션 재생 실패(P3018), Caddy 라우팅(`/relationships`), 브라우저 캐시
- SSH(22번)를 닫고 SSM Session Manager 로 전환, ECR 스캔 기반 베이스 이미지 갱신
  (api Critical 6→0, web Critical 21→1)

## 문서

| 문서 | 내용 |
|---|---|
| [docs/REFACTORING_LOG.md](docs/REFACTORING_LOG.md) | As-Is → 문제 인식 → To-Be 형식의 작업 기록, 트러블슈팅, 후속 과제 |
| [docs/blog/](docs/blog/) | 재배포 과정의 문제 해결 글 3편과 회고 (위 "글 모음") |
| [docs/notes/](docs/notes/) | 개인 학습 메모 |
| [docs/DEPLOY.md](docs/DEPLOY.md) | AWS 배포 런북과 실제 실행에서 달라진 점 |
| [docs/evidence/README.md](docs/evidence/README.md) | 배포·철거 스크린샷 목록(무엇을 증명하는지, 어떤 정보를 가렸는지) |
| [infra/README.md](infra/README.md) | Terraform 구성, SSH 를 닫는 순서 |

## 브랜치 전략

GitHub Flow. `main` 은 항상 배포 가능 상태를 유지하고, 작업 단위마다
`refactor/*` · `feat/*` · `fix/*` · `chore/*` · `docs/*` 브랜치를 만들어 PR 로 병합한다.
커밋 메시지는 Conventional Commits(`type(scope): subject`)를 따른다.

## 로컬 실행

### Docker Compose (전체 스택)

```bash
cp .env.example .env      # POSTGRES_PASSWORD / JWT_SECRET / OPENAI_API_KEY 등 입력
docker compose up --build  # db(pgvector) + embedding(KoSimCSE) + api + web(Caddy)
```

`api` 는 `db`·`embedding` 이 healthy 된 뒤 기동하며, 시작 시 `prisma migrate deploy` 를
스스로 실행한다. 웹은 `http://localhost`(Caddy 가 80 에서 SPA 와 API 프록시를 함께 서빙), Swagger 는 `/api`.

> **기존 v1 데이터가 있다면** (`likeme-like-me-api_postgres_data` 볼륨) `docker compose up` 전에
> `sh scripts/migrate-pg-volume.sh` 를 1회 실행해 새 볼륨으로 이관한다. (자세한 배경은
> `docs/REFACTORING_LOG.md` 의 "루트 compose" / "트러블슈팅 #1")

### 개별 앱 (비 Docker)

각 앱의 `.env.example` 을 복사해 `.env` (api) 를 채운 뒤:

```bash
# backend
cd apps/api && npm install && npm run start:dev

# frontend
cd apps/web && npm install && npm run dev
```
