# 프론트엔드 API 연동 가이드

> 최종 업데이트: 2025-11-18
>
> **중요**: 이 문서는 프론트엔드 개발자를 위한 API 명세입니다.

## 📋 목차

1. [기본 정보](#기본-정보)
2. [인증 (Authentication)](#인증-authentication)
3. [LLM 답변 생성](#llm-답변-생성)
4. [말투 설정 관리 (StyleProfile)](#말투-설정-관리-styleprofile)
5. [카카오톡 업로드](#카카오톡-업로드)
6. [에러 처리](#에러-처리)

---

## 기본 정보

### Base URL
```
http://localhost:3000
```

### Swagger 문서
```
http://localhost:3000/api
```

### 공통 헤더
```http
Content-Type: application/json
Authorization: Bearer {access_token}
```

### 응답 형식
모든 API는 JSON 형식으로 응답합니다.

---

## 인증 (Authentication)

### 1. 회원가입

**Endpoint**: `POST /auth/register`

**Request Body**:
```json
{
  "username": "mingyu",
  "email": "mingyu@test.com",
  "password": "password123",
  "name": "이민수"
}
```

**Response** (201 Created):
```json
{
  "user": {
    "id": "5ffc7298-98c5-44d0-a62e-7a2ac180a64d",
    "username": "mingyu",
    "name": "이민수",
    "email": "mingyu@test.com",
    "created_at": "2025-11-11T14:26:20.811Z"
  },
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**필드 설명**:
- `name`: **필수!** 카카오톡 파싱에 사용됨 (대화 내 이름과 일치해야 함)
- `access_token`: 15분 유효 (API 호출 시 사용)
- `refresh_token`: 30일 유효 (토큰 갱신 시 사용)

---

### 2. 로그인

**Endpoint**: `POST /auth/login`

**Request Body**:
```json
{
  "email": "mingyu@test.com",
  "password": "password123"
}
```

**Response** (200 OK):
```json
{
  "user": {
    "id": "5ffc7298-98c5-44d0-a62e-7a2ac180a64d",
    "username": "mingyu",
    "name": "이민수",
    "email": "mingyu@test.com",
    "created_at": "2025-11-11T14:26:20.811Z"
  },
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

---

### 3. 토큰 갱신

**Endpoint**: `POST /auth/refresh`

**Request Body**:
```json
{
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response** (200 OK):
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**사용 시점**:
- Access Token 만료 (401 Unauthorized) 시 자동 갱신
- 프론트엔드에서 인터셉터 구현 권장

---

### 4. 현재 사용자 정보 조회

**Endpoint**: `GET /auth/me`

**Headers**:
```http
Authorization: Bearer {access_token}
```

**Response** (200 OK):
```json
{
  "id": "5ffc7298-98c5-44d0-a62e-7a2ac180a64d",
  "username": "mingyu",
  "name": "이민수",
  "email": "mingyu@test.com",
  "created_at": "2025-11-11T14:26:20.811Z"
}
```

---

### 5. 로그아웃

**Endpoint**: `POST /auth/logout`

**Headers**:
```http
Authorization: Bearer {access_token}
```

**Response** (200 OK):
```json
{
  "message": "Logged out successfully"
}
```

**주의사항**:
- 로그아웃 시 DB에 저장된 Refresh Token이 무효화됨
- 로그아웃 후 저장된 토큰들을 로컬 스토리지에서 삭제해야 함

---

## LLM 답변 생성

### 1. 답변 생성

**Endpoint**: `POST /llm/generate`

**Headers**:
```http
Authorization: Bearer {access_token}
Content-Type: application/json
```

**Request Body**:
```json
{
  "userId": "5ffc7298-98c5-44d0-a62e-7a2ac180a64d",
  "partnerId": "716d0ed5-c04e-4315-aa8c-05c5ade05b7e",
  "message": "오늘 뭐해?"
}
```

**Response** (200 OK):
```json
{
  "reply": "뭐야, 뭐냐고? ㅋㅋ 지금 뭐 하는 중인데?",
  "context": {
    "recentMessages": [],
    "similarExamples": [
      "?",
      "4시?",
      "그치..?",
      "제",
      "그래야 되는 거 아냐...??"
    ],
    "styleProfile": "존댓말/반말: CASUAL, 말투 분위기: PLAYFUL, 분석된 대화 샘플: 523개",
    "receiverInfo": "김영희 외 2명 (FRIEND_CLOSE)"
  }
}
```

**필드 설명**:
- `userId`: 현재 로그인한 사용자의 ID (JWT에서 추출 가능)
- `partnerId`: 대화 상대의 Partner ID (카카오톡 업로드 시 생성됨)
- `message`: 상대방이 보낸 메시지 내용
- `reply`: LLM가 생성한 답변
- `context`: 디버깅 정보 (프론트에서 선택적 표시 가능)

**에러 응답**:
- `401 Unauthorized`: JWT 토큰 없음 또는 만료
- `404 Not Found`: 사용자 또는 파트너를 찾을 수 없음

**활용 예시**:
```typescript
// React/Next.js 예시
const generateReply = async (partnerId: string, message: string) => {
  const response = await fetch('http://localhost:3000/llm/generate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      userId: currentUser.id,
      partnerId,
      message,
    }),
  });

  const data = await response.json();
  return data.reply; // "뭐야, 뭐냐고? ㅋㅋ 지금 뭐 하는 중인데?"
};
```

---

## 말투 설정 관리 (StyleProfile)

### 🎯 개요

사용자가 직접 자신의 말투 지향성을 설정할 수 있는 기능입니다.
- LLM가 답변 생성 시 우선적으로 참고
- 비속어, 이모티콘 사용 빈도, 문장 길이 등 제어
- 관계 카테고리별 기본값 설정 가능

---

### 1. 말투 설정 저장/업데이트

**Endpoint**: `POST /llm/style-profile`

**Headers**:
```http
Authorization: Bearer {access_token}
Content-Type: application/json
```

**Request Body**:
```json
{
  "customGuidelines": "- 비속어와 욕설을 사용하지 않음\n- 느낌표(!)를 거의 사용하지 않음\n- ㄷㄷ, ~, ㅋㅋㅋㅋ(연속 4개 이상) 사용 자제\n- 친구들에게는 반말, 선배에게는 존댓말\n- 짧고 간결한 문장 선호"
}
```

**Response** (200 OK):
```json
{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "user_id": "5ffc7298-98c5-44d0-a62e-7a2ac180a64d",
  "custom_guidelines": "- 비속어와 욕설을 사용하지 않음\n- 느낌표(!)를 거의 사용하지 않음\n- ㄷㄷ, ~, ㅋㅋㅋㅋ(연속 4개 이상) 사용 자제\n- 친구들에게는 반말, 선배에게는 존댓말\n- 짧고 간결한 문장 선호",
  "updated_at": "2025-11-18T06:30:00.000Z"
}
```

**UI 제안 사항**:
```typescript
// 프론트엔드 입력 폼 예시
const styleProfileForm = {
  useProfanity: false, // 비속어 사용 여부
  useExclamation: 'rarely', // 느낌표 사용 빈도: never, rarely, sometimes, often
  useEmoticons: 'moderate', // 이모티콘 사용 빈도: minimal, moderate, frequent
  sentenceLength: 'short', // 문장 길이: short, medium, long
  formalityByRelation: {
    FRIEND_CLOSE: 'casual', // 친한 친구: 반말
    SENIOR: 'formal', // 선배: 존댓말
    // ... 10개 카테고리
  }
};

// 이를 텍스트로 변환하여 전송
const customGuidelines = `
- 비속어 ${styleProfileForm.useProfanity ? '사용' : '사용하지 않음'}
- 느낌표(!) ${exclamationMap[styleProfileForm.useExclamation]}
- 이모티콘 사용 빈도: ${emoticonMap[styleProfileForm.useEmoticons]}
- 문장 길이: ${lengthMap[styleProfileForm.sentenceLength]}
- 친한 친구에게는 ${styleProfileForm.formalityByRelation.FRIEND_CLOSE === 'casual' ? '반말' : '존댓말'}
`.trim();
```

---

### 2. 말투 설정 조회

**Endpoint**: `GET /llm/style-profile`

**Headers**:
```http
Authorization: Bearer {access_token}
```

**Response** (200 OK):
```json
{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "user_id": "5ffc7298-98c5-44d0-a62e-7a2ac180a64d",
  "custom_guidelines": "- 비속어와 욕설을 사용하지 않음\n- 느낌표(!)를 거의 사용하지 않음\n- ㄷㄷ, ~, ㅋㅋㅋㅋ(연속 4개 이상) 사용 자제",
  "updated_at": "2025-11-18T06:30:00.000Z"
}
```

**Response** (404 Not Found - 설정 없음):
```json
{
  "statusCode": 404,
  "message": "Style profile not found",
  "error": "Not Found"
}
```

---

### 3. 말투 설정 삭제 (기본값으로 리셋)

**Endpoint**: `DELETE /llm/style-profile`

**Headers**:
```http
Authorization: Bearer {access_token}
```

**Response** (200 OK):
```json
{
  "message": "Style profile deleted successfully"
}
```

---

## 카카오톡 업로드

### 1. 카카오톡 txt 파일 업로드

**Endpoint**: `POST /kakao/upload`

**Headers**:
```http
Authorization: Bearer {access_token}
Content-Type: multipart/form-data
```

**Request**:
- Form Data로 파일 전송
- Field name: `file`

**Response** (201 Created):
```json
{
  "message": "카카오톡 대화 업로드 성공",
  "data": {
    "total_messages": 523,
    "my_messages_count": 261,
    "unique_senders": ["이민수", "김영희", "김철수"],
    "created_partners": [
      {
        "id": "716d0ed5-c04e-4315-aa8c-05c5ade05b7e",
        "name": "김영희 외 2명",
        "relationship_category": "FRIEND_CLOSE"
      }
    ]
  }
}
```

**파일 형식**:
- 카카오톡 내보내기 기능으로 생성된 txt 파일
- 두 가지 형식 지원:
  1. `2024. 1. 15. 오후 3:45, 홍길동 : 안녕하세요`
  2. `[이민수] [오후 1:03] 저는 아직 시간표도 못 짰습니다`

**주의사항**:
- 회원가입 시 입력한 `name`과 카카오톡 대화 내 이름이 **정확히 일치**해야 함
- 업로드된 메시지는 자동으로 tone_samples 테이블에 저장됨
- Partner와 Relationship이 자동 생성됨

---

### 2. Partner 목록 조회

**Endpoint**: `GET /kakao/partners`

**Headers**:
```http
Authorization: Bearer {access_token}
```

**Response** (200 OK):
```json
[
  {
    "id": "716d0ed5-c04e-4315-aa8c-05c5ade05b7e",
    "name": "김영희 외 2명",
    "created_at": "2025-11-11T14:30:00.000Z",
    "relationship": {
      "category": "FRIEND_CLOSE",
      "politeness": "CASUAL",
      "vibe": "PLAYFUL"
    }
  },
  {
    "id": "a2b3c4d5-e6f7-8901-bcde-f12345678901",
    "name": "김교수님",
    "created_at": "2025-11-12T10:15:00.000Z",
    "relationship": {
      "category": "PROFESSOR",
      "politeness": "FORMAL",
      "vibe": "CALM"
    }
  }
]
```

**활용 예시**:
- LLM 답변 생성 시 `partnerId` 선택을 위한 목록 표시
- 관계 카테고리에 따라 UI에 아이콘/색상 표시 가능

---

### 3. 임베딩 생성

**Endpoint**: `POST /kakao/generate-embeddings`

**Headers**:
```http
Authorization: Bearer {access_token}
```

**Response** (200 OK):
```json
{
  "message": "임베딩 생성 완료",
  "stats": {
    "total": 523,
    "success": 523,
    "failed": 0,
    "total_tokens": 9352,
    "estimated_cost_usd": 0.000187
  }
}
```

**사용 시점**:
- 카카오톡 업로드 후 자동 호출 권장
- 또는 사용자가 명시적으로 "학습하기" 버튼 클릭 시

**주의사항**:
- 처리 시간이 몇 초 소요될 수 있음 (배치 처리)
- 이미 임베딩이 생성된 메시지는 건너뜀

---

## 에러 처리

### 공통 에러 응답 형식

```json
{
  "statusCode": 400,
  "message": "에러 메시지",
  "error": "Bad Request"
}
```

### 주요 HTTP 상태 코드

| 코드 | 의미 | 처리 방법 |
|------|------|-----------|
| 200 | 성공 | 정상 처리 |
| 201 | 생성됨 | 리소스 생성 성공 |
| 400 | 잘못된 요청 | 입력값 검증 실패, 메시지 표시 |
| 401 | 인증 실패 | 토큰 갱신 시도 → 실패 시 로그인 페이지로 |
| 404 | 찾을 수 없음 | 리소스 없음 안내 |
| 500 | 서버 오류 | "일시적인 오류가 발생했습니다" 표시 |

### 프론트엔드 인터셉터 예시

```typescript
// Axios 예시
import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:3000',
});

// 요청 인터셉터 (토큰 자동 삽입)
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// 응답 인터셉터 (401 시 토큰 갱신)
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = localStorage.getItem('refresh_token');
        const { data } = await axios.post('http://localhost:3000/auth/refresh', {
          refresh_token: refreshToken,
        });

        localStorage.setItem('access_token', data.access_token);
        localStorage.setItem('refresh_token', data.refresh_token);

        originalRequest.headers.Authorization = `Bearer ${data.access_token}`;
        return api(originalRequest);
      } catch (refreshError) {
        // 갱신 실패 → 로그아웃 처리
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default api;
```

---

## 데이터 모델

### 관계 카테고리 (RelationshipCategory)

| 값 | 의미 | 기본 격식 수준 |
|---|------|---------------|
| `FRIEND_CLOSE` | 친한 친구 | 반말, 편한 말투 |
| `FRIEND_ACQUAINTANCE` | 지인 | 반말, 약간 격식 |
| `SENIOR` | 선배 | 존댓말, 적당한 격식 |
| `JUNIOR` | 후배 | 반말 또는 존댓말 |
| `COLLEAGUE` | 동료 | 존댓말, 격식 |
| `PROFESSOR` | 교수님 | 존댓말, 높은 격식 |
| `FAMILY` | 가족 | 상황에 따라 |
| `ROMANTIC` | 연인 | 반말, 친밀함 |
| `BUSINESS` | 비즈니스 관계 | 존댓말, 높은 격식 |
| `OTHER` | 기타 | 기본값 (적당한 격식의 존댓말) |

**기본값 (Default)**:
- 카테고리 설정 없을 시: `OTHER`
- 말투: 적당한 격식의 존댓말
- 이모티콘: 최소 사용
- 비속어: 사용하지 않음

---

## 데이터 필터링 FAQ

### Q1. 비속어가 포함된 카카오톡 대화를 업로드해도 되나요?

**A**: 네, 괜찮습니다.
- 카카오톡 업로드는 **원본 데이터 그대로** DB에 저장합니다.
- LLM가 답변 생성 시 **프롬프트의 제약 조건**에 따라 비속어를 **자동 필터링**합니다.
- 사용자가 "말투 설정"에서 "비속어 사용하지 않음"을 선택하면, LLM는 학습 데이터에 비속어가 있어도 **생성하지 않습니다**.
- 원본 데이터가 많을수록 LLM가 말투를 더 정확히 학습합니다.

**권장사항**:
- 모든 대화 내용을 업로드하세요 (비속어, 이모티콘 포함)
- "말투 설정"에서 원하는 답변 스타일을 지정하세요
- LLM가 알아서 필터링하여 답변을 생성합니다

---

### Q2. 관계 카테고리별로 말투를 다르게 설정하려면?

**A**: "말투 설정" API를 사용하여 관계별 지침을 작성하세요.

```json
{
  "customGuidelines": "- 친한 친구(FRIEND_CLOSE)에게는 반말, 이모티콘 자유롭게 사용\n- 선배(SENIOR)에게는 존댓말, 이모티콘 최소화\n- 교수님(PROFESSOR)에게는 높은 격식의 존댓말, 이모티콘 사용하지 않음"
}
```

LLM가 답변 생성 시 `receiverInfo.category`를 참고하여 적절한 말투를 선택합니다.

---

### Q3. 기본 말투 (Default)는 어떻게 되나요?

**A**: 사용자가 "말투 설정"을 하지 않은 경우:
- **기본값**: 적당한 격식의 존댓말
- **이모티콘**: 최소 사용
- **비속어**: 사용하지 않음
- **문장 길이**: 짧고 간결

이는 처음 사용하는 사용자나 모든 관계에 대한 대화 데이터가 없을 때 안전한 기본값입니다.

---

## 개발 팁

### 1. 토큰 저장

```typescript
// 로그인 성공 시
const { access_token, refresh_token, user } = response.data;
localStorage.setItem('access_token', access_token);
localStorage.setItem('refresh_token', refresh_token);
localStorage.setItem('user', JSON.stringify(user));
```

### 2. 파일 업로드 (React)

```typescript
const uploadKakaoFile = async (file: File) => {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch('http://localhost:3000/kakao/upload', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
    body: formData, // Content-Type은 자동 설정됨
  });

  return response.json();
};
```

### 3. LLM 답변 스트리밍 (향후 지원 예정)

현재는 전체 답변이 완성된 후 반환됩니다.
향후 SSE(Server-Sent Events)를 통한 스트리밍 지원 예정입니다.

---

## 변경 이력

| 날짜 | 버전 | 변경 내용 |
|------|------|-----------|
| 2025-11-18 | 1.2.0 | StyleProfile API 추가, Default 말투 설정 추가 |
| 2025-11-18 | 1.1.0 | LLM Service 구현 완료, POST /llm/generate 추가 |
| 2025-11-12 | 1.0.0 | 초기 문서 작성 (Auth, Kakao 업로드) |

---

## 문의 및 지원

- **Swagger 문서**: http://localhost:3000/api
- **이슈 제보**: GitHub Issues
- **API 테스트**: Swagger UI 또는 Postman 사용 권장
