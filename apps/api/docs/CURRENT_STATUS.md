# 프로젝트 현재 상태

> 최종 업데이트: 2025-11-18 15:10

## ✅ 완료된 작업

### 1. 인프라 설정
- **Docker + PostgreSQL 16 + pgvector 0.5.1** 설정 완료
  - 포트: 5433
  - 데이터베이스: `chatbot_db`
  - 사용자: `admin`
  - **Prisma 마이그레이션**으로 스키마 관리 (init.sql 삭제됨)
  - pgvector 확장 설치 및 HNSW 인덱스 생성됨

### 2. 데이터베이스 스키마 (Prisma Migrations)
**생성된 테이블 (9개):**
```sql
users, partners, conversations, messages, relationships,
style_profiles, tone_samples, knowledge_chunks, message_embeddings
```

**벡터 컬럼:**
- `tone_samples.embedding`: vector(1536) - OpenAI text-embedding-3-small 차원
- `knowledge_chunks.embedding`: vector(1536)
- `message_embeddings.embedding`: vector(1536)
- HNSW 인덱스: `idx_tone_samples_embedding` (cosine similarity)

**Users 테이블 (Auth 지원):**
- `id` (UUID, Primary Key)
- `username` (VARCHAR(50), UNIQUE, NOT NULL)
- `name` (VARCHAR(100), NULLABLE) - **중요: 카카오톡 파싱에 사용됨**
- `email` (VARCHAR(255), UNIQUE, NOT NULL)
- `password_hash` (VARCHAR(255), NOT NULL)
- `telegram_id` (VARCHAR(100), UNIQUE, NULLABLE) - **텔레그램 봇 소유자 식별용**
- `refresh_token` (VARCHAR(500), NULLABLE)
- `created_at` (TIMESTAMP, DEFAULT NOW())

### 3. NestJS 백엔드

#### 3.1 Prisma ORM 통합 ✅
- `PrismaModule` 구현 (`src/prisma/`)
- Prisma DB Pull 완료 (9개 모델 동기화)
- Prisma Client 생성 완료
- 모든 테이블, 관계, Enum 타입 매핑 완료

#### 3.2 Auth 모듈 (JWT 인증) ✅
**구현된 기능:**
- ✅ `POST /auth/register` - 회원가입 (username, email, password, name)
- ✅ `POST /auth/login` - 로그인 (email, password)
- ✅ `POST /auth/refresh` - Access Token 갱신
- ✅ `GET /auth/me` - 현재 사용자 정보 조회
- ✅ `POST /auth/logout` - 로그아웃 (Refresh Token 무효화)

**보안 구현:**
- bcrypt 비밀번호 해싱 (saltRounds: 10)
- JWT Access Token (15분 유효)
- JWT Refresh Token (30일 유효, DB 저장)
- Passport JWT Strategy
- JWT Auth Guard (인증 보호)
- Swagger Bearer 인증 통합

**파일 구조:**
```
src/modules/auth/
├── auth.module.ts
├── auth.controller.ts
├── auth.service.ts
├── dto/
│   ├── register.dto.ts
│   ├── login.dto.ts
│   ├── refresh.dto.ts
│   └── index.ts
├── guards/
│   └── jwt-auth.guard.ts
├── interfaces/
│   ├── jwt-user.interface.ts
│   ├── auth-response.interface.ts
│   └── index.ts
└── strategies/
    └── jwt.strategy.ts
```

#### 3.3 Kakao 모듈 (카카오톡 업로드) ✅ **NEW!**
**구현된 기능:**
- ✅ `POST /kakao/upload` - 카카오톡 txt 파일 업로드
- ✅ `GET /kakao/partners` - 업로드된 Partner 목록 조회
- ✅ 두 가지 카카오톡 형식 지원:
  - 형식 1: `2024. 1. 15. 오후 3:45, 홍길동 : 안녕하세요`
  - 형식 2: `[이민수] [오후 1:03] 저는 아직 시간표도 못 짰습니다`
- ✅ 날짜 헤더 파싱: `--------------- 2025년 8월 5일 화요일 ---------------`
- ✅ 사용자 이름 기반 메시지 필터링 (user.name 사용)
- ✅ Partner & Relationship 자동 생성
- ✅ tone_samples 배치 저장
- ✅ JWT 인증 보호
- ✅ Multipart 파일 업로드 (multer)

**파일 구조:**
```
src/modules/kakao/
├── kakao.module.ts
├── kakao.controller.ts
├── kakao.service.ts
├── dto/
│   ├── upload-kakao.dto.ts
│   └── index.ts
└── parsers/
    └── kakao-txt.parser.ts
```

**파싱 로직:**
- 정규식 기반 메시지 파싱
- 날짜 헤더 인식 및 추적
- 초대 메시지, 시스템 메시지 자동 필터링
- 통계 정보 제공 (total_messages, my_messages_count, unique_senders)

#### 3.4 Telegram 봇 연동 ✅ (Phase 4 진행 중)
- Long Polling 방식
- ✅ 텍스트 메시지 수신 및 **DB 저장** (Partner, Conversation, Message)
- ✅ Partner 자동 생성 (telegram_id 기준 upsert)
- ✅ User 식별 로직 (봇 소유자 = 서비스 회원)
- ✅ 메시지 전송 API
- 🔄 인메모리 저장 병행 (기존 API 호환성)
- AI 추천 답변 생성 (임시 하드코딩)
- 선택 답변 전송

#### 3.5 SSE (Server-Sent Events) 실시간 알림 ✅
- RxJS `Subject<SavedMessage>` 사용
- 엔드포인트: `GET /telegram/events`
- 새 메시지 도착 시 자동 알림

#### 3.6 기타 설정 ✅
- CORS 설정 (모든 origin 허용 - 개발 환경)
- Swagger API 문서 (`http://localhost:3000/api`)
  - Bearer 인증 통합 완료
  - App Controller 숨김 처리 (개발용 엔드포인트)
- TypeScript strict mode
- ESLint 설정
  - `_` 변수 경고 무시 패턴 추가

### 4. Git 워크플로우
- 현재 브랜치: `feat/kakao-upload`
- 최근 커밋:
  - JWT 기반 인증 시스템 구현 완료
  - 카카오톡 업로드 기능 완전 구현
  - 두 가지 카카오톡 형식 지원
  - 사용자 이름 기반 메시지 필터링

---

## 🔄 최근 업데이트 (2025-11-18)

### Phase 3: GPT Service 구현 완료 ✅ **NEW!**
**구현 완료:**
- ✅ GPT 모듈 생성 (`src/modules/gpt/`)
- ✅ GptService 6개 핵심 메서드 구현
  - `generateReply()` - 메인 답변 생성 메서드
  - `getRecentContext()` - 최근 대화 20개 조회 (Conversation → Message)
  - `getSimilarContext()` - pgvector 유사도 검색 (15개 예시)
  - `getStyleProfile()` - ToneSample 통계 분석 (politeness, vibe)
  - `getReceiverInfo()` - Partner & Relationship 정보 조회
  - `buildPrompt()` - GPT 프롬프트 구성 (system + user messages)
- ✅ GPT Controller 구현
  - `POST /gpt/generate` - JWT 인증 보호, Swagger 문서화
- ✅ DTO 및 Interface 정의
  - `GenerateReplyDto` - 요청 검증 (userId, partnerId, message)
  - `GenerateReplyResponse` - 응답 형식 (reply + context)
- ✅ Swagger Authorization 이슈 해결
  - `@ApiBearerAuth('access-token')` 추가로 토큰 전송 문제 해결

**GPT 설정 최적화:**
- Model: `gpt-4o-mini` (빠르고 저렴)
- Temperature: 0.9 (창의적이고 자연스러운 답변)
- Max Tokens: 100 (충분한 답변 길이)
- Similar Examples: 15개 (풍부한 말투 컨텍스트)

**E2E 테스트 완료:**
- ✅ 로그인 → GPT 답변 생성 → 응답 확인
- ✅ 벡터 유사도 검색 정상 작동 (HNSW 인덱스)
- ✅ 관계별 정보 반영 확인 (FRIEND_CLOSE 등)
- ✅ Context 디버깅 정보 포함 (recentMessages, similarExamples, styleProfile, receiverInfo)

**테스트 결과 예시:**
```json
{
  "reply": "뭐야, 뭐냐고? ㅋㅋ 지금 뭐 하는 중인데?",
  "context": {
    "recentMessages": [],
    "similarExamples": ["?", "4시?", "그치..?", "제", "그래야 되는 거 아냐...??"],
    "styleProfile": "",
    "receiverInfo": "김영희 외 2명 (FRIEND_CLOSE)"
  }
}
```

**파일 구조:**
```
src/modules/gpt/
├── gpt.module.ts
├── gpt.controller.ts
├── gpt.service.ts (370+ lines)
├── dto/
│   ├── generate-reply.dto.ts
│   └── index.ts
└── interfaces/
    └── gpt.interface.ts
```

---

### Phase 1 & 2: OpenAI 모듈 및 임베딩 생성 완료 ✅
**구현 완료:**
- ✅ OpenAI SDK 설치 및 모듈 생성 (`src/modules/openai/`)
- ✅ OpenaiService 구현
  - `createEmbedding(text)` - 단일 임베딩 생성
  - `createEmbeddings(texts[])` - 배치 임베딩 생성
  - `generateChatCompletion(messages)` - GPT 답변 생성
- ✅ 임베딩 생성 엔드포인트 추가: `POST /kakao/generate-embeddings`
- ✅ **PostgreSQL 벡터 인덱스 이슈 해결**:
  - 문제: B-tree 인덱스는 최대 2704 바이트까지만 처리 가능
  - 해결: B-tree → HNSW 인덱스로 변경 (고차원 벡터 검색 최적화)
  - 벡터 타입 명시: `vector` → `vector(1536)`
  - Migration: [20251111151827_remove_btree_indexes_on_vectors](../prisma/migrations/20251111151827_remove_btree_indexes_on_vectors/)
  - Migration: [20251111151900_add_hnsw_indexes_on_vectors](../prisma/migrations/20251111151900_add_hnsw_indexes_on_vectors/)

**E2E 테스트 완료:**
- ✅ 523개 tone_samples 임베딩 생성 성공 (100% 성공률)
- ✅ 총 토큰 사용량: 9,352 tokens
- ✅ 예상 비용: $0.000187 (약 ₩0.26)
- ✅ 평균 처리 속도: 17.9 tokens/message
- ✅ 배치 처리: 6 batches (100개씩)
- ✅ DB 저장 확인: tone_samples.embedding 컬럼에 1536차원 벡터 저장됨

**파일 구조:**
```
src/modules/openai/
├── openai.module.ts
├── openai.service.ts
└── interfaces/
    └── openai.interface.ts
```

**환경변수:**
- `OPENAI_API_KEY` - AI 팀 제공 API 키 사용 (.env)

---

### AI 팀 FastAPI 코드 수령 및 통합 계획 수립 ✅
**배경:**
- ✅ AI 팀으로부터 GPT 프롬프트 로직이 구현된 FastAPI 코드 수령 ([app.py](../app.py))
- ✅ FastAPI를 별도 서버로 운영하지 않고 NestJS에 직접 통합하기로 결정
- ✅ GPT 통합 계획 문서 작성 완료 ([GPT_INTEGRATION_PLAN.md](./GPT_INTEGRATION_PLAN.md))

**FastAPI 코드 분석:**
- GPT 모델: `gpt-4o-mini` (저렴, 빠름)
- Temperature: 0.7 (적당한 창의성)
- Max Tokens: 60 (짧은 답변 강제)
- 프롬프트 구조: 말투 프로필 + 수신자 정보 포함
- 문제점: DB 미사용, 임베딩 없음, API 키 하드코딩

**통합 방향:**
1. ✅ **Phase 1**: OpenAI 모듈 생성 (기반 작업) - **완료**
2. ✅ **Phase 2**: 임베딩 생성 (tone_samples → pgvector) - **완료**
3. **Phase 3**: GPT Service 구현 (FastAPI 로직 포팅) - **다음 단계**
4. **Phase 4**: Telegram 자동 답변 통합

**AI 팀 요구사항 검증:**
- ✅ `recent_context`: 최근 대화 N개 (구현됨)
- ✅ `similar_context`: 임베딩 유사도 검색 (Phase 2 완료, 벡터 저장됨)
- ❓ `style_profile`: txt 파일 (구체적 방법 협의 필요)
- ✅ `receiver`: 관계 정보 (relationships 테이블)

---

### Phase 4: Telegram DB 저장 구현 ✅
**구현 완료:**
- ✅ Prisma 마이그레이션 방식 전환 (init.sql 삭제)
- ✅ User 스키마에 telegram_id 필드 추가
- ✅ Telegram 메시지 DB 저장 로직 구현
  - Partner 자동 생성 (telegram_id 기준 upsert)
  - Conversation 자동 생성 (user_id + partner_id)
  - Message 저장 (role: user)
- ✅ User vs Partner 아키텍처 명확화:
  - **User**: 봇 소유자 (서비스 회원, JWT 인증)
  - **Partner**: 메시지 발신자 (외부 텔레그램 사용자, telegram_id 식별)
- ✅ SSE 이벤트 발송 (실시간 알림 유지)
- ✅ 채팅 목록 API 구현 (`GET /telegram/conversations`)
- ✅ 대화 히스토리 API 구현 (`GET /telegram/conversations/:partnerId/messages`)

**E2E 테스트 완료:**
- ✅ Telegram 메시지 수신 → Partner 자동 생성 확인
- ✅ Conversation 자동 생성 확인
- ✅ Messages 테이블에 저장 확인
- ✅ 채팅 목록 API 응답 확인
- ✅ 대화 히스토리 API 응답 확인 (페이지네이션 포함)

**변경 사항:**
- init.sql 삭제 → Prisma 마이그레이션으로 단일 소스 관리
- telegram.service.ts의 saveReceivedMessage 메서드 DB 저장 로직 추가
- telegram.service.ts에 getConversations, getConversationMessages 메서드 추가
- telegram.controller.ts에 GET /conversations, GET /conversations/:partnerId/messages 엔드포인트 추가
- .env에 DEFAULT_USER_ID 추가 (환경변수 관리)

**TODO:**
- [ ] Relationship 관리 API 구현 (Telegram Partner용)

---

## 🚧 현재 제한사항

### 미구현 기능
- ❌ **OpenAI GPT 통합**: OpenAI 모듈은 완료, GPT Service 구현 예정 (Phase 3)
- ❌ **Relationship 관리 API**: 현재 카카오톡 업로드 시에만 생성 가능 (Telegram Partner용 필요)

### 알려진 이슈
- ⚠️ **Partner 중복**: 같은 이름으로 카카오톡 업로드 시 중복 생성 가능

---

## 📋 다음 단계

### 🎯 GPT 통합 로드맵 (우선순위: 최고) ⭐⭐⭐

AI 팀 FastAPI 코드를 NestJS에 통합하는 전체 계획입니다.
자세한 내용은 [GPT_INTEGRATION_PLAN.md](./GPT_INTEGRATION_PLAN.md) 참조.

#### ✅ Phase 1: OpenAI 모듈 생성 (기반 작업) - **완료**
**목표**: OpenAI API 연동 기반 구축

**구현 완료:**
1. ✅ OpenAI SDK 설치 (`npm install openai`)
2. ✅ 환경변수 설정 (`OPENAI_API_KEY`)
3. ✅ OpenAI Module 생성 (`src/modules/openai/`)
4. ✅ OpenaiService 구현
   - `createEmbedding(text: string)` - 임베딩 생성
   - `createEmbeddings(texts: string[])` - 배치 임베딩 생성
   - `generateChatCompletion(messages)` - GPT 답변 생성

**실제 소요 시간**: 약 30분

#### ✅ Phase 2: 임베딩 생성 - **완료**
**목표**: tone_samples의 텍스트를 임베딩으로 변환하여 DB 저장

**구현 완료:**
1. ✅ Embedding Service 메서드 추가
   - `createEmbeddings(texts: string[])` - 배치 임베딩
2. ✅ Kakao Service에 임베딩 엔드포인트 추가
   - `POST /kakao/generate-embeddings` - 전체 tone_samples 임베딩 생성
3. ✅ DB 저장 로직 (Prisma raw query, vector 타입 처리)
4. ✅ 배치 처리 (100개씩, 에러 처리)
5. ✅ **PostgreSQL B-tree → HNSW 인덱스 마이그레이션**

**실제 소요 시간**: 약 2시간 (인덱스 이슈 해결 포함)

#### Phase 3: GPT Service 구현 (핵심)
**목표**: FastAPI의 GPT 로직을 NestJS로 포팅

**구현 항목:**
1. GPT Module 생성 (`src/modules/gpt/`)
2. GptService 메서드 구현
   - `generateReply()` - 메인 메서드
   - `getRecentContext()` - 최근 대화 조회
   - `getSimilarContext()` - pgvector 유사도 검색
   - `getStyleProfile()` - 말투 프로필 조회
   - `getReceiverInfo()` - 관계 정보 조회
   - `buildPrompt()` - 프롬프트 구성
3. GPT Controller 구현
   - `POST /gpt/generate` - 답변 생성 API
4. DTO 및 인터페이스 정의

**예상 소요 시간**: 2-3시간

#### Phase 4: Telegram 자동 답변 통합
**목표**: Telegram 메시지 수신 시 자동으로 GPT 답변 생성

**구현 항목:**
1. TelegramService에 GPT 연동
   - 메시지 수신 → GPT 답변 생성 → SSE 전송
2. 답변 전송 API 개선
   - DB 기반 대화 내역 → GPT 호출 → 답변 생성

**예상 소요 시간**: 1시간

---

### 🎯 Relationship 관리 API (우선순위: 중간)
**목표**: Telegram Partner용 관계 설정 기능

**구현 항목:**
- `POST /relationships` - 관계 생성
- `GET /relationships` - 관계 목록 조회
- `PATCH /relationships/:id` - 관계 수정
- `DELETE /relationships/:id` - 관계 삭제

---

## 🔧 유용한 명령어

### Docker 관리
```bash
# 컨테이너 시작
docker-compose up -d

# 로그 확인
docker-compose logs -f postgres

# DB 접속
docker exec -it chatbot_db psql -U admin -d chatbot_db

# 테이블 목록 확인
docker exec -it chatbot_db psql -U admin -d chatbot_db -c "\dt"
```

### Prisma 관리
```bash
# DB 스키마 가져오기
npx prisma db pull

# Prisma Client 생성
npx prisma generate

# Prisma Studio (DB GUI)
npx prisma studio
```

### 애플리케이션 실행
```bash
# 개발 모드
npm run start:dev

# 빌드
npm run build

# 프로덕션 모드
npm run start:prod

# TypeScript 타입 체크
npx tsc --noEmit

# ESLint 체크
npm run lint
```

### API 테스트
```bash
# Swagger 문서
http://localhost:3000/api

# 회원가입 (name 필수!)
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"mingyu","email":"mingyu@test.com","password":"123456","name":"이민수"}'

# 로그인
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"mingyu@test.com","password":"123456"}'

# 카카오톡 업로드 (Swagger 사용 권장)
# 1. Swagger에서 Authorize 클릭
# 2. access_token 입력
# 3. POST /kakao/upload에서 파일 업로드

# Partner 목록 조회
curl -X GET http://localhost:3000/kakao/partners \
  -H "Authorization: Bearer {ACCESS_TOKEN}"
```

---

## 📚 참고 문서

- `README.md` - 프로젝트 개요 및 빠른 시작
- `docs/GPT_INTEGRATION_PLAN.md` - **[NEW!]** GPT 통합 계획 (FastAPI → NestJS)
- `docs/DB_SCHEMA.md` - 데이터베이스 스키마 상세 설명
- `docs/SETUP_GUIDE.md` - 설치 및 설정 가이드
- `docs/API_SPECIFICATION.md` - API 명세서 (프론트엔드용)
- `docs/FRONTEND_INTEGRATION.md` - 프론트엔드 연동 가이드
- `docs/AUTH_ARCHITECTURE.md` - JWT 인증 아키텍처 가이드
- `docs/IMPLEMENTATION_PLAN.md` - 전체 구현 계획
- `docs/CHANGELOG.md` - 변경 이력
- `app.py` - AI 팀 제공 FastAPI 코드 (참고용)

---

## 📊 용량 관련 정보

### PostgreSQL 용량
- **테이블 최대 크기**: 32 TB
- **메시지 1개당 크기**:
  - 텍스트만 (embedding 없음): ~250 bytes
  - 텍스트 + embedding: ~6,400 bytes

### 예상 사용량
- 3,000 메시지 (embedding 없음): ~0.75 MB
- 3,000 메시지 (embedding 포함): ~19 MB
- 50개 파일 (150,000 메시지): ~1 GB
- **결론**: 수십 개 파일 업로드는 전혀 문제없음

---

## 🎯 핵심 기술 개념

### JWT 인증
- Access Token: 15분 유효 (자주 갱신으로 보안 강화)
- Refresh Token: 30일 유효 (DB 저장, 재로그인 불편 감소)
- Stateless 인증 (서버 재시작해도 로그인 유지)
- Bearer Token 방식 (`Authorization: Bearer {token}`)

### 카카오톡 파싱
- 두 가지 형식 지원 (날짜 포함, 대괄호 형식)
- 날짜 헤더 자동 인식
- 사용자 이름 기반 필터링 (JWT의 user.name 사용)
- 시스템 메시지 자동 필터링

### 텔레그램 봇 (Long Polling)
- **방식**: Long Polling (2-3초마다 서버가 텔레그램 서버에 확인)
- **메시지 흐름**: 상대방 → 텔레그램 서버 → 내 로컬 서버 (API 경유)
- **보관 정책**: 미수신 메시지는 텔레그램 서버에 24시간 보관
- **주의사항**:
  - 한 번 수신한 메시지는 텔레그램 서버에서 삭제됨
  - 서버가 24시간 이상 꺼져있으면 메시지 손실
  - 봇 계정은 일반 사용자 앱에서 대화 내용 확인 불가 (API 전용)
- **현재 제한**: 인메모리 저장으로 서버 재시작 시 데이터 손실 (Phase 4에서 해결 예정)

### pgvector
- PostgreSQL 확장
- 벡터 유사도 검색 (cosine, L2, inner product)
- HNSW 알고리즘으로 빠른 근사 최근접 이웃 검색
- 1536차원 벡터 지원 (OpenAI embedding)

### RAG (Retrieval-Augmented Generation)
- AI 응답에 검색된 컨텍스트 추가
- 벡터 DB에서 유사한 예시 검색
- GPT 프롬프트에 포함하여 더 정확한 답변 생성

### 10개 관계 카테고리
- 상대방과의 관계에 따라 말투 자동 조정
- 존댓말/반말, 이모지 빈도, 격식 수준 차별화
- DB의 `relationships` 테이블에서 관리
