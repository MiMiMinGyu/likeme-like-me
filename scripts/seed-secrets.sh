#!/bin/sh
# ==============================================================================
# 로컬 env 파일 → SSM Parameter Store  (배포 전 1회, 노트북에서 실행)
#
# 콘솔에서 파라미터를 손으로 만드는 대신, 이미 만들어 둔 프로덕션용 env 파일을
# 그대로 SSM 에 밀어넣는다. 이후 콘솔에서 목록을 확인(스크린샷)하면 된다.
#
# 사용:  ./scripts/seed-secrets.sh <소스-env-파일>
#   예:  ./scripts/seed-secrets.sh .env.prod.local
#   환경변수: SSM_PREFIX(기본 /likemelikeme/prod), AWS_REGION(기본 ap-northeast-2)
#
# 필요 IAM 권한 (실행 주체): ssm:PutParameter (+ SecureString 이면 kms:Encrypt).
#
# 비밀 성격의 키는 SecureString, 나머지는 String 으로 올린다 (아래 is_secure).
# 값이 빈 키는 건너뛴다 (TELEGRAM_BOT_TOKEN 등 옵션).
# ==============================================================================
set -eu

PREFIX="${SSM_PREFIX:-/likemelikeme/prod}"
REGION="${AWS_REGION:-ap-northeast-2}"
SRC="${1:?사용법: seed-secrets.sh <소스-env-파일>}"

[ -f "$SRC" ] || { echo "파일 없음: $SRC" >&2; exit 1; }
command -v aws >/dev/null 2>&1 || { echo "aws CLI 가 필요합니다" >&2; exit 1; }

is_secure() {
  case "$1" in
    POSTGRES_PASSWORD|JWT_SECRET|OPENAI_API_KEY|TELEGRAM_BOT_TOKEN) return 0 ;;
    *) return 1 ;;
  esac
}

while IFS= read -r line || [ -n "$line" ]; do
  case "$line" in ''|\#*) continue ;; esac
  key="${line%%=*}"
  val="${line#*=}"
  [ "$key" != "$line" ] || continue          # '=' 없는 줄 무시
  if [ -z "$val" ]; then echo "건너뜀 $key (빈 값)"; continue; fi
  if is_secure "$key"; then TYPE=SecureString; else TYPE=String; fi
  aws ssm put-parameter --region "$REGION" \
    --name "${PREFIX%/}/$key" --type "$TYPE" --value "$val" --overwrite >/dev/null
  echo "put ${PREFIX%/}/$key ($TYPE)"
done < "$SRC"
