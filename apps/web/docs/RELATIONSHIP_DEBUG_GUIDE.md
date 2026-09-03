# 관계 설정 디버깅 가이드

> 관계 설정을 변경했는데도 AI 답변이 똑같을 때 확인하는 방법

## 🔍 프론트엔드 체크리스트

### 1️⃣ 관계 설정이 DB에 정상 저장되었는지 확인

**테스트 방법:**
1. 채팅방에서 관계 설정 모달 열기 (⚙️ 버튼)
2. 설정 변경 후 저장 버튼 클릭
3. 개발자 도구 콘솔 확인

**기대되는 로그:**
```
📞 [API 호출] POST /relationships {partnerId: "...", category: "FRIEND_CLOSE", ...}
📥 [API 응답] 관계 생성 성공: {id: "...", category: "FRIEND_CLOSE", ...}
```

또는 (수정 시)
```
📞 [API 호출] PATCH /relationships/abc-123 {category: "WORK_SENIOR_FORMAL", ...}
📥 [API 응답] 관계 수정 성공: {id: "abc-123", category: "WORK_SENIOR_FORMAL", ...}
```

**확인 사항:**
- ✅ 응답 status가 200 또는 201
- ✅ 응답 데이터에 저장한 값이 그대로 포함됨
- ❌ 401/500 에러 → 백엔드 문제

---

### 2️⃣ 관계 설정이 조회되는지 확인

**테스트 방법:**
1. 채팅방 새로고침 (F5)
2. 콘솔에서 관계 조회 로그 확인

**기대되는 로그:**
```
📞 [API 호출] GET /relationships
📥 [API 응답] 관계 목록: [{id: "...", partner_id: "abc-123", category: "FRIEND_CLOSE", ...}]
🔗 [관계 조회] partnerId: abc-123
✅ [관계 조회] 현재 partner의 관계 설정 찾음: {category: "FRIEND_CLOSE", politeness: "CASUAL", ...}
```

**확인 사항:**
- ✅ 전체 관계 목록에 해당 partnerId가 있음
- ✅ 현재 partner의 관계 설정이 올바르게 매칭됨
- ⚠️ "현재 partner의 관계 설정 없음" → 저장은 됐지만 partnerId 불일치

---

### 3️⃣ AI 추천 생성 시 관계 정보가 함께 전달되는지 확인

**테스트 방법:**
1. 텔레그램 봇으로 메시지 전송
2. SSE로 메시지 수신되면 자동으로 AI 추천 생성
3. 콘솔 로그 확인

**기대되는 로그:**
```
🤖 [AI 추천] messageId: d70e7086-5367-4656-88fb-e670f1a43479
🤖 [AI 추천] 현재 관계 설정: {
  id: "...",
  partner_id: "abc-123",
  category: "FRIEND_CLOSE",
  politeness: "CASUAL",
  vibe: "PLAYFUL",
  emoji_level: 5
}
🤖 [AI 추천] partnerId: abc-123
📞 [API 호출] POST /telegram/recommendations {messageId: "d70e7086-..."}
📥 [API 응답] 추천 답변: {recommendations: [{text: "...", tone: "positive"}, ...]}
🤖 [AI 추천] 생성된 추천 답변: [{text: "...", tone: "positive"}, ...]
```

**확인 사항:**
- ✅ `현재 관계 설정`이 null이 아니고 올바른 값이 출력됨
- ✅ `partnerId`가 올바름
- ⚠️ `현재 관계 설정: null` → 관계 설정을 안 했거나 partnerId 불일치

---

## 🔴 백엔드 확인 요청 사항

위 3가지가 모두 정상인데도 답변이 똑같다면, **백엔드 문제**입니다.

### 백엔드 팀에게 요청할 내용

#### 1. POST /telegram/recommendations에서 relationship 조회 여부 확인

```
질문:
POST /telegram/recommendations API 호출 시,
messageId로부터 partnerId를 추출하고,
해당 partnerId의 relationship 정보를 DB에서 조회하고 있나요?

확인 방법:
백엔드 로그에 다음을 출력해주세요.
console.log('[LLM] messageId:', messageId);
console.log('[LLM] partnerId:', partnerId);
console.log('[LLM] relationship:', relationship);
```

#### 2. LLM 프롬프트에 relationship 정보 반영 여부 확인

```
질문:
relationship 정보를 LLM 프롬프트에 포함시키고 있나요?

확인 방법:
LLM API 호출 직전 프롬프트를 콘솔에 출력해주세요.
console.log('[LLM] 전달되는 프롬프트:', prompt);

기대되는 내용:
- "존댓말 수준: CASUAL (반말)"
- "대화 분위기: PLAYFUL (장난스러운)"
- "이모지 사용: 5 (매우 많이 사용)"
```

#### 3. 테스트 시나리오 공유

```markdown
## 재현 방법

### 설정 A: 친한 친구
- category: FRIEND_CLOSE
- politeness: CASUAL
- vibe: PLAYFUL
- emoji_level: 5

### 설정 B: 상사
- category: WORK_SENIOR_FORMAL
- politeness: FORMAL
- vibe: CALM
- emoji_level: 0

### 테스트
같은 메시지 "오늘 뭐해?"에 대해 각각 답변 생성

**기대 결과:**
- 설정 A: "야 ㅋㅋㅋ 뭐하냐 😆😎🎉"
- 설정 B: "오늘 무슨 일정이 있으신가요?"

**실제 결과:**
- 둘 다 똑같은 답변 생성됨
```

---

## 📊 문제 원인별 해결 방법

### 케이스 1: 관계 설정이 저장 안 됨
**증상:**
```
❌ [API 실패] 관계 생성: 500 Internal Server Error
```

**해결:** 백엔드 로그 확인, DB 연결 상태 확인

---

### 케이스 2: 관계 설정은 저장되었지만 조회 안 됨
**증상:**
```
📥 [API 응답] 관계 목록: []  // 빈 배열
⚠️ [관계 조회] 현재 partner의 관계 설정 없음
```

**원인:**
- DB에 저장된 `partner_id`와 프론트엔드 `partnerId`가 다름
- JWT 토큰의 userId가 다름 (다른 계정으로 저장됨)

**해결:**
```sql
-- DB 직접 확인
SELECT * FROM relationships WHERE user_id = '현재유저ID';
```

---

### 케이스 3: 관계 설정은 조회되지만 AI 추천에 반영 안 됨
**증상:**
```
✅ [관계 조회] 현재 partner의 관계 설정 찾음: {category: "FRIEND_CLOSE", ...}
🤖 [AI 추천] 현재 관계 설정: {category: "FRIEND_CLOSE", ...}
📥 [API 응답] 추천 답변: [...] // 하지만 답변이 똑같음
```

**원인:**
- 백엔드에서 relationship 정보를 LLM 프롬프트에 반영하지 않음

**해결:** 백엔드 팀에게 위 "백엔드 확인 요청 사항" 전달

---

## 🧪 빠른 테스트 방법

### 브라우저 콘솔에서 직접 테스트

```javascript
// 1. 관계 목록 조회
const relationships = await fetch('http://localhost:3000/relationships', {
  headers: { 'Authorization': `Bearer ${localStorage.getItem('access_token')}` }
}).then(r => r.json());
console.log('내 관계 목록:', relationships);

// 2. 특정 partner의 관계 확인
const partnerId = 'd7bd6ba7-5fa8-415d-a42b-15cdc03adaac';
const myRelation = relationships.find(r => r.partner_id === partnerId);
console.log('현재 partner 관계:', myRelation);

// 3. AI 추천 생성 테스트
const messageId = 'd70e7086-5367-4656-88fb-e670f1a43479';
const recommendations = await fetch('http://localhost:3000/telegram/recommendations', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ messageId })
}).then(r => r.json());
console.log('추천 답변:', recommendations);
```

---

## 📞 문의

추가 디버깅이 필요하면 다음 정보를 공유해주세요:
1. 프론트엔드 콘솔 전체 로그 (스크린샷)
2. 네트워크 탭에서 API 요청/응답 (Raw)
3. 사용한 partnerId, messageId
