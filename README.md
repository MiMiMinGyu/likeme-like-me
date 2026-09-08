# LikemeLikeMe

메신저로 연락이 온 상대의 지난 대화를 참고해, 본인 말투를 학습한 LLM이 적절한 답변 후보를
생성하고 위치된 휴대폰에서 클릭 한 번으로 전송하는 RAG 기반 캡스톤 프로젝트.

- **backend** — NestJS 11, Prisma, PostgreSQL + pgvector, OpenAI, Telegram(telegraf), JWT
- **frontend** — React 19, Vite 7, React Router 7, axios

## 저장소 구조

```
likemelikeme/
├── apps/
│   ├── api/   # NestJS 백엔드 (구 likeme-like-me-api)
│   ├── web/   # React 프론트엔드 (구 likeme-like-me-web)
│   └── embedding/   # KoSimCSE 임베딩 서비스 (FastAPI, Python)
└── docker-compose.yml   # db + embedding + api 오케스트레이션
```

원래 팀 프로젝트에서는 분업/협업을 위해 프론트엔드와 백엔드를 **분리된 두 저장소**
(`Capstone2_FE`, `Capstone2_BE`)로 운영했다. 개인 리팩토링 단계에서 전체를 **하나의
배포 단위**로 다루기 위해 모노레포로 통합하고, 이후 Docker Compose 로 오케스트레이션한다.
각 앱의 팀 커밋 히스토리는 원본 팀 저장소에 그대로 보존되어 있으며, 이 저장소는
`v0-original` 태그를 기준선으로 리팩토링 이력만 선형으로 쌓는다.

## 리팩토링 로드맵

| 태그 | 내용 |
|------|------|
| `v0-original` | 원본 캡스톤 상태 스냅샷 (FE/BE 통합) |
| `v1-dockerized` | 백엔드 Dockerfile 작성 · 이미지 빌드 |
| `v2-compose` | 백엔드 + DB 멀티 컨테이너 (Docker Compose) |
| `v3-aws` | AWS 배포 (EC2 / ECR) |

### 주요 리팩토링 항목

- GPT API 키를 팀원 개인 키 → 본인 키로 교체, `.env` / Secrets 분리
- 임베딩 모델 교체 (OpenAI `text-embedding-3-small` → `BM-K/KoSimCSE-roberta-multitask`)
- DB 연결 점검 및 Compose 기반 재구성
- 환경변수 하드코딩 제거

## 브랜치 전략

GitHub Flow. `main` 은 항상 배포 가능 상태를 유지하고, 작업 단위마다
`refactor/*` · `feat/*` · `fix/*` · `chore/*` · `docs/*` 브랜치를 만들어 PR 로 병합한다.
커밋 메시지는 Conventional Commits(`type(scope): subject`)를 따른다.

## 로컬 실행

### Docker Compose (백엔드 전체 스택)

```bash
cp .env.example .env      # POSTGRES_PASSWORD / JWT_SECRET / OPENAI_API_KEY 등 입력
docker compose up --build  # db(pgvector) + embedding(KoSimCSE) + api
```

`api` 는 `db`·`embedding` 이 healthy 된 뒤 기동하며, 시작 시 `prisma migrate deploy` 를
스스로 실행한다. API 는 `http://localhost:3000`, Swagger 는 `/api`.

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
