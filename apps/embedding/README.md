# apps/embedding — KoSimCSE 임베딩 서비스

한국어 문장 임베딩을 HTTP 로 제공하는 파이썬 마이크로서비스.
`apps/api` 가 기존 OpenAI `text-embedding-3-small`(1536차원) 의존을 이 서비스로 교체한다.

- 모델: `BM-K/KoSimCSE-roberta-multitask` (RoBERTa-base, **768차원**)
- 풀링: CLS 토큰 + L2 정규화
- 스택: FastAPI + transformers + torch(CPU)

## API

| 메서드 | 경로 | 설명 |
|---|---|---|
| `GET` | `/health` | 모델 로드 여부, 차원 수 |
| `POST` | `/embed` | `{ "texts": ["..."] }` → `{ "embeddings": [[...768]], "model": "...", "dim": 768 }` |

## 로컬 실행 (Docker)

```bash
# 빌드 (모델을 이미지에 구움 — 첫 빌드는 다운로드로 수 분)
docker build -t likeme-embedding apps/embedding

# 실행
docker run --rm -p 8000:8000 --name likeme-embedding likeme-embedding

# 스모크 테스트
curl -s localhost:8000/health
curl -s -X POST localhost:8000/embed \
  -H 'content-type: application/json' \
  -d '{"texts":["행님 오늘 뭐함","형 오늘 뭐해"]}' | python -m json.tool
```

두 문장은 의미가 거의 같으므로 임베딩 코사인 유사도가 높게 나와야 한다(정상 동작 확인용).

## 환경변수

| 변수 | 기본값 | 설명 |
|---|---|---|
| `MODEL_ID` | `BM-K/KoSimCSE-roberta-multitask` | HF 모델 ID |
| `MAX_BATCH` | `256` | 요청 1건 내부 배치 크기 |
| `MAX_LENGTH` | `128` | 토큰 최대 길이 (카톡 초단문 위주) |

## 비고

- 루트 통합 `docker-compose.yml`(로드맵 5단계)에 서비스로 편입 예정. 현재는 단독 실행.
- 이미지에 모델을 굽는 방식 선택 이유: 컨테이너 기동 즉시 가능, 오프라인 동작, 재현성.
  대가는 이미지 크기(+~475MB). 런타임 다운로드 + 볼륨 캐시 방식으로 바꾸려면 Dockerfile 의
  3번 스텝 제거 + `HF_HOME` 을 볼륨 마운트.
