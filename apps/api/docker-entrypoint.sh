#!/bin/sh
# API 컨테이너 진입점.
#   1) DB 스키마를 최신 마이그레이션까지 맞춘다 (prisma migrate deploy — 멱등).
#   2) 전달받은 CMD(기본: node dist/main.js) 를 exec 로 교체 실행해
#      PID 1 이 되게 한다 (SIGTERM 이 Node 로 바로 전달 → graceful shutdown).
#
# RUN_MIGRATIONS=false 로 두면 마이그레이션 단계를 건너뛴다
# (마이그레이션을 별도 Job 으로 분리하는 배포에서 사용).
set -e

if [ "${RUN_MIGRATIONS:-true}" = "true" ]; then
  echo "[entrypoint] prisma migrate deploy..."
  ./node_modules/.bin/prisma migrate deploy
else
  echo "[entrypoint] RUN_MIGRATIONS=false — 마이그레이션 건너뜀"
fi

echo "[entrypoint] exec: $*"
exec "$@"
