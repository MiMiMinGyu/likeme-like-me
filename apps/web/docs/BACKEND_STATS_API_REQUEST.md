# 백엔드 통계 API 구현 요청

## 📊 문제 상황

프론트엔드에서 설정 페이지 접근 시 `GET /auth/stats` API 호출 시 **404 Not Found** 에러 발생

## 🎯 요청 사항

다음 API 엔드포인트를 구현해주세요:

### API 명세

**Endpoint**: `GET /auth/stats`

**Headers**:
```http
Authorization: Bearer {access_token}
```

**Response** (200 OK):
```json
{
  "conversations": 3,
  "totalMessages": 1247,
  "myMessages": 623,
  "toneSamples": 523,
  "relationships": 5
}
```

**필드 설명**:
- `conversations`: 사용자가 업로드한 전체 대화 수
- `totalMessages`: 업로드된 대화의 전체 메시지 수 (내 메시지 + 상대방 메시지)
- `myMessages`: 사용자가 보낸 메시지 수 (톤 샘플 학습에 사용)
- `toneSamples`: 생성된 톤 샘플 수 (내 메시지 기반)
- `relationships`: 사용자가 설정한 관계 수

## 💡 데이터 출처 (참고)

각 통계는 다음 테이블에서 조회 가능합니다:

1. **conversations**: `conversations` 테이블
   ```sql
   SELECT COUNT(*) FROM conversations WHERE user_id = ?
   ```

2. **totalMessages**: `messages` 테이블 (모든 메시지)
   ```sql
   SELECT COUNT(*) FROM messages m
   JOIN conversations c ON m.conversation_id = c.id
   WHERE c.user_id = ?
   ```

3. **myMessages**: `messages` 테이블 (is_from_me = true)
   ```sql
   SELECT COUNT(*) FROM messages m
   JOIN conversations c ON m.conversation_id = c.id
   WHERE c.user_id = ? AND m.is_from_me = true
   ```

4. **toneSamples**: `tone_samples` 테이블
   ```sql
   SELECT COUNT(*) FROM tone_samples WHERE user_id = ?
   ```

5. **relationships**: `relationships` 테이블
   ```sql
   SELECT COUNT(*) FROM relationships WHERE user_id = ?
   ```

## 🔒 인증

- JWT 토큰 필수 (`Authorization: Bearer {access_token}`)
- 토큰에서 `user_id` 추출하여 해당 사용자의 통계만 조회

## ⚠️ 에러 처리

| 상태 코드 | 설명 |
|----------|------|
| 200 OK | 정상 조회 |
| 401 Unauthorized | 토큰 없음 또는 만료 |
| 500 Internal Server Error | 서버 오류 |

## 📝 참고

- 현재 프론트엔드는 404 발생 시 모든 통계를 0으로 표시하도록 임시 처리됨
- API 구현 후 실제 통계가 정상적으로 표시될 예정
- 설정 페이지에서 사용자에게 업로드한 데이터와 생성된 톤 샘플을 시각적으로 보여주는 용도

## 🧪 테스트 예시

**Request**:
```bash
curl -X GET http://localhost:3000/auth/stats \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

**Expected Response**:
```json
{
  "conversations": 3,
  "totalMessages": 1247,
  "myMessages": 623,
  "toneSamples": 523,
  "relationships": 5
}
```

---

## 📅 우선순위

**우선순위**: 중간 (Nice to have)
- 필수 기능은 아니지만 사용자 경험 향상을 위해 구현 권장
- 현재 프론트엔드는 fallback으로 0 표시 중
