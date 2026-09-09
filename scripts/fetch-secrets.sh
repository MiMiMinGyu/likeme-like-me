#!/bin/sh
# ==============================================================================
# SSM Parameter Store → .env  (EC2 에서 배포 직전 실행)
#
# 배경: 시크릿(OPENAI_API_KEY, JWT_SECRET, POSTGRES_PASSWORD ...)을 이미지·저장소·
#   AMI 어디에도 넣지 않는다. EC2 의 IAM 인스턴스 프로파일 권한으로 SSM 에서
#   그때그때 읽어 로컬 .env 를 만들고, docker compose 가 그 .env 를 주입한다.
#   .env 는 인스턴스에만 존재하고 chmod 600, 저장소엔 안 올라간다.
#
# 사용:  ./scripts/fetch-secrets.sh [출력파일]      (기본: 저장소 루트 .env)
#   환경변수로 조정: SSM_PREFIX(기본 /likemelikeme/prod), AWS_REGION(기본 ap-northeast-2)
#
# 필요 IAM 권한 (인스턴스 프로파일):
#   ssm:GetParametersByPath  on  arn:aws:ssm:<region>:<acct>:parameter/likemelikeme/prod/*
#   kms:Decrypt              on  SSM 암호화에 쓰인 키 (기본 alias/aws/ssm 이면 별도 불필요)
#
# 한계: 값에 탭/개행이 있으면 깨진다. 여기 쓰는 값들(토큰·비밀번호·도메인)은 단일 행이라 무방.
# ==============================================================================
set -eu

PREFIX="${SSM_PREFIX:-/likemelikeme/prod}"
REGION="${AWS_REGION:-ap-northeast-2}"
OUT="${1:-.env}"
TAB="$(printf '\t')"

command -v aws >/dev/null 2>&1 || { echo "aws CLI 가 필요합니다" >&2; exit 1; }

TMP="$(mktemp)"
trap 'rm -f "$TMP"' EXIT

# aws cli v2 는 기본 자동 페이지네이션 → 10개 초과 파라미터도 전부 가져온다.
aws ssm get-parameters-by-path \
  --path "${PREFIX%/}/" --recursive --with-decryption \
  --region "$REGION" \
  --query 'Parameters[].[Name,Value]' --output text \
| while IFS="$TAB" read -r name value; do
    printf '%s=%s\n' "${name##*/}" "$value"
  done > "$TMP"

[ -s "$TMP" ] || { echo "SSM $PREFIX 아래에 파라미터가 없습니다" >&2; exit 1; }

# 필수 키 존재 확인 — 하나라도 없으면 배포 중단
for req in POSTGRES_PASSWORD JWT_SECRET OPENAI_API_KEY ECR_REGISTRY SITE_ADDRESS; do
  grep -q "^${req}=" "$TMP" || { echo "필수 키 누락: $req (SSM $PREFIX)" >&2; exit 1; }
done

chmod 600 "$TMP"
mv "$TMP" "$OUT"
trap - EXIT
echo "$(grep -c '=' "$OUT") 개 변수를 $PREFIX 에서 읽어 $OUT 에 기록"
