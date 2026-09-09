# scripts/

| 스크립트 | 실행 위치 | 용도 |
|---|---|---|
| `migrate-pg-volume.sh` | 로컬 (1회성) | v1(PG15) 볼륨 → v2(PG16) compose 볼륨 논리 덤프/복원 |
| `seed-secrets.sh` | 노트북 (배포 전 1회) | 로컬 프로덕션 env 파일 → SSM Parameter Store 업로드 |
| `fetch-secrets.sh` | EC2 (배포 직전마다) | SSM Parameter Store → 인스턴스 로컬 `.env` 생성 |

## 시크릿 흐름 (배포)

이미지·저장소·AMI 어디에도 시크릿을 넣지 않는다. 순서:

```
# 1) 노트북: 프로덕션용 값을 담은 임시 env 파일 작성 (커밋 금지, .gitignore 처리됨)
cp .env.example .env.prod.local
$EDITOR .env.prod.local          # 실제 키/도메인/ECR_REGISTRY 입력

# 2) 노트북: SSM 에 업로드 (비밀은 SecureString, 나머지 String)
./scripts/seed-secrets.sh .env.prod.local
rm .env.prod.local               # 로컬에서 삭제

# 3) EC2: IAM 인스턴스 프로파일 권한으로 .env 재구성 후 기동
./scripts/fetch-secrets.sh
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

## SSM 파라미터 레이아웃

경로 접두어 `/likemelikeme/prod/` (환경변수 `SSM_PREFIX` 로 변경 가능).

| 이름 | 타입 | 비고 |
|---|---|---|
| `.../POSTGRES_PASSWORD` | SecureString | |
| `.../JWT_SECRET` | SecureString | 32자 이상 |
| `.../OPENAI_API_KEY` | SecureString | |
| `.../OPENAI_MODEL` | String | 예: `gpt-4o-mini` |
| `.../TELEGRAM_BOT_TOKEN` | SecureString | 옵션 — 비우면 봇 비활성화 |
| `.../DEFAULT_USER_ID` | String | 텔레그램 쓸 때만 |
| `.../SITE_ADDRESS` | String | 도메인 (Caddy Let's Encrypt) |
| `.../ECR_REGISTRY` | String | `<acct>.dkr.ecr.<region>.amazonaws.com` |
| `.../IMAGE_TAG` | String | ECR 에 push 한 태그 (git SHA 권장) |

## 필요 IAM 권한

**노트북 (seed):** `ssm:PutParameter` (+ SecureString 이면 `kms:Encrypt`).

**EC2 인스턴스 프로파일 (fetch + ECR pull):**
- `ssm:GetParametersByPath` on `arn:aws:ssm:<region>:<acct>:parameter/likemelikeme/prod/*`
- `kms:Decrypt` — SSM 기본 키(`alias/aws/ssm`)면 대개 불필요, CMK 쓰면 필요
- `ecr:GetAuthorizationToken`, `ecr:BatchGetImage`, `ecr:GetDownloadUrlForLayer`

구체적인 정책 JSON 은 `infra/` (F단계 Terraform) 참고.
