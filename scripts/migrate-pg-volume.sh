#!/bin/sh
# ==============================================================================
# v1 → v2 데이터 이관 (1회성)
#
# 배경: v1 까지의 DB 는 옛 apps/api/docker-compose.yml (compose 프로젝트명
#   likeme-like-me-api) 이 만든 볼륨 `likeme-like-me-api_postgres_data` 에 있다.
#   이 볼륨은 PostgreSQL 15 + pgvector 0.5.1 로 초기화돼 있음.
#   루트 docker-compose.yml 은 프로젝트명이 `likemelikeme` 라 그냥 up 하면
#   빈 볼륨 `likemelikeme_db_data` 를 새로 만든다 (트러블슈팅 #1 의 함정).
#   게다가 새 이미지는 pgvector/pgvector:pg16 (PG16) 이라 데이터 디렉터리를
#   그대로 이어붙일 수도 없다 → 논리 덤프(pg_dump)/복원으로 넘긴다.
#
# 흐름: 옛 볼륨을 PG15 이미지로 잠깐 띄워 pg_dump(-Fc) → 새 compose db(PG16)로
#   pg_restore. external 볼륨으로 물리지 않아서, 클론한 사람은 이 스크립트 없이
#   그냥 `docker compose up` 하면 되는 상태가 된다.
#
# 전제: Docker Desktop 실행 중. 저장소 루트에서 실행. 루트 .env 존재.
# 안전: 옛 볼륨은 읽기만 한다. 실패해도 원본 보존 → 옛 compose 로 롤백 가능.
# ==============================================================================
set -eu
export MSYS_NO_PATHCONV=1 # Git Bash(Windows) 경로 자동변환 방지

OLD_VOLUME="likeme-like-me-api_postgres_data"
TMP_CTR="pgdump-v1-tmp"
DUMP_FILE="./v1-chatbot_db.$(date +%Y%m%d%H%M%S).dump"
DB_NAME="chatbot_db"
DB_USER="admin"

echo "==> 1/6  옛 볼륨 확인"
docker volume inspect "$OLD_VOLUME" >/dev/null 2>&1 || {
  echo "    옛 볼륨 '$OLD_VOLUME' 가 없습니다. 이관할 데이터가 없으면 스크립트 불필요." >&2
  exit 1
}

echo "==> 2/6  옛 볼륨을 PG15 이미지로 임시 기동"
docker rm -f "$TMP_CTR" >/dev/null 2>&1 || true
docker run -d --name "$TMP_CTR" \
  -v "${OLD_VOLUME}:/var/lib/postgresql/data" \
  pgvector/pgvector:pg15 >/dev/null
echo "    pg_isready 대기..."
until docker exec "$TMP_CTR" pg_isready -U "$DB_USER" -d "$DB_NAME" >/dev/null 2>&1; do
  sleep 1
done

echo "==> 3/6  pg_dump (-Fc, 압축 커스텀 포맷)"
docker exec "$TMP_CTR" pg_dump -U "$DB_USER" -d "$DB_NAME" -Fc -f /tmp/v1.dump
docker cp "${TMP_CTR}:/tmp/v1.dump" "$DUMP_FILE"
docker rm -f "$TMP_CTR" >/dev/null
echo "    덤프: $DUMP_FILE ($(du -h "$DUMP_FILE" | cut -f1))"

echo "==> 4/6  새 compose db(PG16) 기동 + healthy 대기"
docker compose up -d db
until [ "$(docker inspect -f '{{.State.Health.Status}}' chatbot_db 2>/dev/null)" = "healthy" ]; do
  sleep 2
done

echo "==> 5/6  pg_restore (빈 DB 로 복원, --no-owner --no-comments)"
docker compose cp "$DUMP_FILE" db:/tmp/restore.dump
docker compose exec -T db pg_restore -U "$DB_USER" -d "$DB_NAME" \
  --no-owner --no-comments /tmp/restore.dump

echo "==> 6/6  검증 (행 수)"
docker compose exec -T db psql -U "$DB_USER" -d "$DB_NAME" -c \
  "SELECT 'tone_samples' AS t, count(*) FROM tone_samples
   UNION ALL SELECT 'messages',      count(*) FROM messages
   UNION ALL SELECT 'users',         count(*) FROM users
   UNION ALL SELECT 'partners',      count(*) FROM partners
   UNION ALL SELECT 'relationships', count(*) FROM relationships;"

cat <<EOF

완료. tone_samples ≈ 17943 이면 이관 성공.
다음: docker compose up --build   (전체 스택)
정리: docker volume rm $OLD_VOLUME   (옛 볼륨 — 확인 후)
      rm $DUMP_FILE
EOF
