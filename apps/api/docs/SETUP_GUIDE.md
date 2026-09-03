# 프로젝트 설정 가이드

## 목차
1. [환경 요구사항](#환경-요구사항)
2. [데이터베이스 설정](#데이터베이스-설정)
3. [Prisma 설정](#prisma-설정)
4. [NestJS 통합](#nestjs-통합)
5. [환경 변수 설정](#환경-변수-설정)
6. [검증 및 테스트](#검증-및-테스트)

---

## 환경 요구사항

### 필수 소프트웨어
- **Node.js**: 18.x 이상
- **npm**: 9.x 이상
- **Docker**: 20.x 이상
- **Docker Compose**: 2.x 이상

### 확인 명령어
```bash
node --version  # v18.x 이상
npm --version   # 9.x 이상
docker --version
docker-compose --version
```

---

## 데이터베이스 설정

### 1단계: Docker Compose로 PostgreSQL + pgvector 시작

```bash
# 기존 컨테이너가 있다면 완전 삭제
docker-compose down -v

# 새 컨테이너 시작
docker-compose up -d

# 상태 확인
docker ps

# 출력 예시:
# CONTAINER ID   IMAGE                    STATUS         PORTS
# abc123def456   ankane/pgvector:v0.5.1  Up 10 seconds  0.0.0.0:5433->5432/tcp
```

### 2단계: Prisma 마이그레이션 적용

```bash
# Prisma Client 생성
npx prisma generate

# 마이그레이션 적용 (스키마 생성)
npx prisma migrate dev

# 샘플 데이터 생성
npx prisma db seed
```

**출력 확인:**
```
✅ Test user created: testuser
✅ Mingyu user created: 미민수
✅ Partner created: 엄마
✅ Partner created: 친구
✅ Partner created: 팀장님
✅ Relationship created: testuser - 엄마
✅ Relationship created: testuser - 친구
✅ Relationship created: testuser - 팀장님
✅ Tone samples created: 6 samples
🎉 Database seed completed successfully!
```

### 3단계: 데이터베이스 접속 테스트

```bash
# psql로 직접 접속
docker exec -it chatbot_db psql -U admin -d chatbot_db

# PostgreSQL 프롬프트에서:
\dt              # 테이블 목록 확인
\d+ relationships  # relationships 테이블 상세 확인
SELECT * FROM users;  # 샘플 데이터 확인
\q               # 종료
```

---

## Prisma 설정

### 마이그레이션 관리

이 프로젝트는 **Prisma 마이그레이션**을 사용하여 데이터베이스 스키마를 관리합니다.
`init.sql` 파일은 더 이상 사용하지 않습니다.

### 스키마 변경 워크플로우

#### 1. 스키마 수정
`prisma/schema.prisma` 파일을 수정합니다.

#### 2. 마이그레이션 생성
```bash
npx prisma migrate dev --name 설명적인_이름
```

예시:
```bash
npx prisma migrate dev --name add_emoji_field_to_user
```

#### 3. 마이그레이션 적용 확인
```
✔ Generated Prisma Client
✔ Applied migration: 20251110121714_add_emoji_field_to_user
```

#### 4. Git에 커밋
```bash
git add prisma/migrations prisma/schema.prisma
git commit -m "feat: Add emoji field to User model"
```

### 주요 Prisma 명령어

```bash
# Prisma Client 재생성 (스키마 변경 후)
npx prisma generate

# 스키마 검증
npx prisma validate

# 마이그레이션 상태 확인
npx prisma migrate status

# 샘플 데이터 생성
npx prisma db seed

# Prisma Studio (GUI) 실행
npx prisma studio
```

### Prisma Studio 사용법

```bash
npx prisma studio
```

브라우저에서 `http://localhost:5555` 열림
- 모든 테이블 시각적으로 확인
- 데이터 CRUD 작업 가능
- 관계(Relation) 탐색 가능

---

## NestJS 통합

### 1단계: PrismaModule 생성

```bash
# Prisma 모듈 디렉토리 생성
mkdir -p src/prisma
```

`src/prisma/prisma.service.ts` 생성:

```typescript
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await this.$connect();
    console.log('✅ Prisma connected to database');
  }

  async onModuleDestroy() {
    await this.$disconnect();
    console.log('🔌 Prisma disconnected from database');
  }
}
```

`src/prisma/prisma.module.ts` 생성:

```typescript
import { Module, Global } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
```

### 2단계: AppModule에 등록

`src/app.module.ts` 수정:

```typescript
import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    PrismaModule,  // 추가
    // 기타 모듈들...
  ],
})
export class AppModule {}
```

---

## 환경 변수 설정

### .env 파일 생성

프로젝트 루트에 `.env` 파일 생성:

```bash
# 데이터베이스
DATABASE_URL="postgresql://admin:admin1234@localhost:5433/chatbot_db"
POSTGRES_PASSWORD=admin1234

# OpenAI API
OPENAI_API_KEY=your_openai_api_key_here

# Telegram Bot
TELEGRAM_BOT_TOKEN=your_telegram_bot_token_here

# 서버 설정
PORT=3000
NODE_ENV=development
```

### 환경 변수 설명

| 변수명 | 설명 | 예시 |
|--------|------|------|
| DATABASE_URL | PostgreSQL 연결 문자열 | postgresql://admin:admin1234@localhost:5433/chatbot_db |
| POSTGRES_PASSWORD | DB 비밀번호 | admin1234 |
| OPENAI_API_KEY | OpenAI API 키 | sk-... |
| TELEGRAM_BOT_TOKEN | 텔레그램 봇 토큰 | 123456:ABC-DEF... |

### 보안 주의사항

`.gitignore` 확인:

```bash
# .gitignore에 다음 내용이 있는지 확인
.env
.env.local
.env.*.local
```

---

## 검증 및 테스트

### 1단계: 애플리케이션 시작

```bash
npm run start:dev
```

### 2단계: 콘솔 출력 확인

```
[Nest] LOG [NestFactory] Starting Nest application...
[Nest] LOG [InstanceLoader] PrismaModule dependencies initialized
✅ Prisma connected to database
[Nest] LOG [NestApplication] Nest application successfully started
```

### 3단계: 데이터베이스 연결 테스트

간단한 테스트 엔드포인트 생성:

`src/app.controller.ts`:

```typescript
import { Controller, Get } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';

@Controller()
export class AppController {
  constructor(private prisma: PrismaService) {}

  @Get('/test-db')
  async testDb() {
    const users = await this.prisma.user.findMany();
    const partners = await this.prisma.partner.findMany();
    const relationships = await this.prisma.relationship.findMany({
      include: {
        partner: true,
      },
    });

    return {
      message: '✅ Database connection successful',
      data: {
        users: users.length,
        partners: partners.length,
        relationships: relationships.length,
      },
    };
  }
}
```

브라우저에서 접속:
```
http://localhost:3000/test-db
```

예상 출력:
```json
{
  "message": "✅ Database connection successful",
  "data": {
    "users": 1,
    "partners": 3,
    "relationships": 3
  }
}
```

### 4단계: Prisma Studio로 데이터 확인

```bash
npx prisma studio
```

`http://localhost:5555`에서:
- `users` 테이블: `default_user` 확인
- `partners` 테이블: 3명 (부모님, 친구, 상사님) 확인
- `relationships` 테이블: 3개 관계 설정 확인
- `tone_samples` 테이블: 6개 샘플 확인

---

## 트러블슈팅

### 문제 1: "Can't reach database server"

**원인**: Docker 컨테이너가 실행되지 않음

**해결**:
```bash
docker ps  # 컨테이너 확인
docker-compose up -d  # 컨테이너 시작
```

### 문제 2: "Type error: Type 'X' is not assignable to type 'Y'"

**원인**: Prisma Client가 생성되지 않음

**해결**:
```bash
npx prisma generate
npm run build
```

### 문제 3: "Extension 'vector' does not exist"

**원인**: pgvector 확장이 설치되지 않음

**해결**:
```bash
docker-compose down -v
docker-compose up -d
npx prisma migrate dev
```

### 문제 4: "Migration ... failed to apply"

**원인**: 데이터베이스 스키마가 마이그레이션 히스토리와 맞지 않음

**해결 (개발 환경):**
```bash
# 경고: 모든 데이터가 삭제됩니다!
docker-compose down -v
docker-compose up -d
npx prisma migrate dev
npx prisma db seed
```

**해결 (프로덕션 환경):**
```bash
# 마이그레이션 상태 확인
npx prisma migrate status

# 마이그레이션 직접 적용
npx prisma migrate deploy
```

### 문제 5: "users.name column does not exist" (협업자 환경)

**원인**: `init.sql`과 `schema.prisma`가 동기화되지 않음 (구버전)

**해결**:
```bash
# 최신 코드 pull
git pull origin main

# Docker 초기화
docker-compose down -v
docker-compose up -d

# Prisma 마이그레이션 적용
npx prisma generate
npx prisma migrate dev
npx prisma db seed
```

### 문제 4: "Port 5433 is already in use"

**원인**: 다른 서비스가 포트 사용 중

**해결**:
1. `docker-compose.yml`에서 포트 변경:
   ```yaml
   ports:
     - "5434:5432"  # 5433 → 5434
   ```

2. `.env`에서 DATABASE_URL 포트 변경:
   ```
   DATABASE_URL="postgresql://admin:admin1234@localhost:5434/chatbot_db"
   ```

### 문제 5: UTF-8 인코딩 오류

**원인**: Windows에서 파일 인코딩 문제

**해결**:
- VS Code에서 파일 인코딩을 UTF-8로 변경
- 우측 하단 인코딩 클릭 → "Save with Encoding" → "UTF-8" 선택

---

## 다음 단계

설정이 완료되면 다음 작업을 진행할 수 있습니다:

1. **관계 설정 API 구현** (`src/relationship/`)
   - GET `/api/relationships/:partnerId`
   - PUT `/api/relationships/:partnerId`

2. **대화 관리 API 구현** (`src/conversation/`)
   - POST `/api/conversations`
   - GET `/api/conversations/:id/messages`
   - POST `/api/conversations/:id/messages`

3. **톤 샘플 관리 API 구현** (`src/tone-sample/`)
   - POST `/api/tone-samples`
   - GET `/api/tone-samples`

4. **임베딩 생성 워커 구현** (`src/embedding/`)
   - OpenAI API 연동
   - 벡터 임베딩 생성 및 저장

5. **RAG 검색 로직 구현** (`src/retrieval/`)
   - pgvector 유사도 검색
   - 컨텍스트 구성

6. **AI 오케스트레이터 구현** (`src/orchestrator/`)
   - 컨텍스트 수집
   - GPT API 호출
   - 응답 후처리

7. **Telegram 봇 연동** (`src/telegram/`)
   - 웹훅 설정
   - 메시지 수신/송신

---

## 참고 자료

- [Prisma NestJS 가이드](https://docs.nestjs.com/recipes/prisma)
- [pgvector 설치 가이드](https://github.com/pgvector/pgvector#installation)
- [OpenAI API 문서](https://platform.openai.com/docs)
- [Telegram Bot API](https://core.telegram.org/bots/api)

---

**설정 완료!** 이제 개발을 시작할 수 있습니다.
