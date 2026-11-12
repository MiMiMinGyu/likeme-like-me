# LikemeLikeMe — AWS 배포 런북 (v3-aws)

> 단일 EC2 위에 `docker compose` 로 전체 스택을 올린다. 포트폴리오 증거(문서·스크린샷·
> 화면 녹화)를 남긴 뒤 **모든 리소스를 삭제**해 상시 비용을 0 으로 되돌리는 것이 목표.
> 재배포는 이 문서 + `infra/`(Terraform)로 10~30분이면 된다.
>
> `📸` = 스크린샷/녹화 지점.  `TODO(값)` = 실제 배포 때 채우는 자리.

---

## 0. 아키텍처

```
                 인터넷
                   │  :80/:443
          ┌────────▼─────────┐
          │  EC2 (t3.small)  │   Security Group: 22(내 IP), 80, 443
          │                  │
          │  docker compose  │   -f docker-compose.yml -f docker-compose.prod.yml
          │  ┌────────────┐  │
          │  │ web (Caddy)│  │   SPA 서빙 + /auth /llm /telegram ... → api 프록시
          │  ├────────────┤  │                     + Let's Encrypt 자동 HTTPS
          │  │ api (Nest) │  │   entrypoint: prisma migrate deploy
          │  ├────────────┤  │
          │  │ embedding  │  │   KoSimCSE 768 (내부 전용)
          │  ├────────────┤  │
          │  │ db (pgvec) │  │   볼륨 db_data (내부 전용)
          │  └────────────┘  │
          └──────┬───────────┘
                 │ pull                    outbound
          ┌──────▼──────┐          ┌───────────────┐
          │  ECR (x3)   │          │  OpenAI API   │
          └─────────────┘          └───────────────┘
          ┌─────────────┐
          │ SSM Param    │  /likemelikeme/prod/*  (SecureString)
          │ Store        │  → fetch-secrets.sh → .env
          └─────────────┘
```

- 컨테이너 간 통신은 compose 네트워크(서비스명). **호스트에 열리는 포트는 web 80/443 뿐.**
- 시크릿은 이미지·저장소·AMI 에 없음 → EC2 의 IAM 역할로 SSM 에서 읽어 `.env` 생성.

---

## 1. 사전 준비 (노트북, 1회)

- [ ] AWS 계정. **루트 대신 IAM 사용자**로 작업 (`AdministratorAccess` 는 이 실습 한정, 이후 회수).
  📸 IAM 사용자 + 연결된 정책
- [ ] `aws configure` — 리전 `ap-northeast-2`(서울), IAM 사용자 액세스 키.
- [ ] **비용 알림**: Billing → Budgets → 월 `$5` 알림 (이메일).  📸 Budget 설정 화면
- [ ] Free tier 페이지 스냅샷 (사용량·만료일).  📸
- [ ] Docker Desktop 실행 (이미지 빌드용). `docker buildx` 사용.

---

## 2. ECR — 리포지토리 생성 + 이미지 push (노트북, 1회 / 재배포 시 push 만)

```sh
export AWS_REGION=ap-northeast-2
export ACCOUNT_ID=TODO(aws sts get-caller-identity --query Account --output text)
export ECR_REGISTRY=$ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com
export IMAGE_TAG=$(git rev-parse --short HEAD)          # git SHA 를 태그로

# 2.1 리포지토리 3개
for name in likeme-api likeme-web likeme-embedding; do
  aws ecr create-repository --repository-name $name --region $AWS_REGION \
    --image-scanning-configuration scanOnPush=true || true
done
# 📸 ECR 콘솔 — 리포지토리 3개

# 2.2 로그인
aws ecr get-login-password --region $AWS_REGION \
  | docker login --username AWS --password-stdin $ECR_REGISTRY

# 2.3 빌드 + push (EC2 가 x86 이므로 linux/amd64)
docker buildx build --platform linux/amd64 -t $ECR_REGISTRY/likeme-api:$IMAGE_TAG        --push apps/api
docker buildx build --platform linux/amd64 -t $ECR_REGISTRY/likeme-web:$IMAGE_TAG        --push apps/web
docker buildx build --platform linux/amd64 -t $ECR_REGISTRY/likeme-embedding:$IMAGE_TAG  --push apps/embedding
# 📸 push 터미널 출력(digest) + ECR 콘솔의 이미지 태그·크기
```

---

## 3. SSM Parameter Store — 시크릿 seed (노트북, 1회)

```sh
cp .env.example .env.prod.local
$EDITOR .env.prod.local
#   POSTGRES_PASSWORD  = 새 랜덤값
#   JWT_SECRET         = openssl rand -base64 48
#   OPENAI_API_KEY     = 본인 키
#   OPENAI_MODEL       = gpt-4o-mini
#   TELEGRAM_BOT_TOKEN = (쓰면) @BotFather 토큰 / 안 쓰면 빈 값
#   DEFAULT_USER_ID    = (텔레그램 쓰면) 앱 사용자 UUID
#   SITE_ADDRESS       = TODO(도메인, 예 likemelikeme.duckdns.org)
#   ECR_REGISTRY       = 위 $ECR_REGISTRY
#   IMAGE_TAG          = 위 $IMAGE_TAG

./scripts/seed-secrets.sh .env.prod.local
rm .env.prod.local
# 📸 SSM Parameter Store 콘솔 — /likemelikeme/prod/* 목록 (값은 가려진 상태)
```

---

## 4. 인프라 프로비저닝 (Terraform, `infra/`)

> 상세는 `infra/README.md`. 최소 구성: default VPC + 보안 그룹 1 + EC2 1 + EIP 1 +
> IAM 인스턴스 프로파일(SSM read + ECR pull). user-data 로 docker/compose 설치 + 저장소 clone.

```sh
cd infra
terraform init
terraform apply         # var: my_ip, key_name, instance_type=t3.small
# 📸 terraform apply 출력 (생성 리소스 목록 + EIP 주소)
cd ..
```

산출: `TODO(EIP)`, 인스턴스 ID `TODO`.
📸 EC2 콘솔 인스턴스 상세(타입·AMI·리전) / EIP 연결 / 보안 그룹 인바운드 규칙

### 4.1 DNS

- DuckDNS(무료): 서브도메인 생성 → IP 를 `TODO(EIP)` 로 설정. `SITE_ADDRESS` 와 일치시킬 것.
- 또는 보유 도메인의 A 레코드 → `TODO(EIP)`.
- `dig +short TODO(도메인)` 이 EIP 를 반환하는지 확인 후 다음 단계 (Caddy 인증서 발급 조건).

---

## 5. 배포 (EC2)

```sh
ssh -i ~/.ssh/TODO.pem ec2-user@TODO(EIP)
# 📸 SSH 접속 성공 (uname -a)

# user-data 가 안 했다면: docker, docker compose plugin, git 설치 + 저장소 clone
cd likemelikeme
git checkout TODO(배포 브랜치/태그)          # 예: v3-aws

export AWS_REGION=ap-northeast-2
./scripts/fetch-secrets.sh                    # SSM → .env (chmod 600)
grep -c '=' .env                              # 기대: 9

aws ecr get-login-password --region $AWS_REGION \
  | docker login --username AWS --password-stdin "$(grep '^ECR_REGISTRY=' .env | cut -d= -f2)"

docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --pull always
docker compose -f docker-compose.yml -f docker-compose.prod.yml ps
# 📸 compose ps — 전부 Up/healthy
docker compose -f docker-compose.yml -f docker-compose.prod.yml logs api | grep -E "migrate deploy|successfully started"
# 📸 entrypoint migrate deploy + "Nest application successfully started"
free -h; swapon --show; df -h /
# 📸 메모리·swap·디스크
```

### 5.1 텔레그램 (쓰는 경우)

- 봇이 webhook 모드면: `https://TODO(도메인)/telegram/...` 를 setWebhook 으로 등록.
- long-polling 모드면 별도 설정 없음.

---

## 6. 검증 (증거 수집)

- [ ] `curl -I https://TODO(도메인)/` → `200`, `curl https://TODO(도메인)/test-db` → 행 수 JSON
  (`users` 2 / `partners` 21 / `relationships` 18 기대)  📸
- [ ] 브라우저에서 `https://TODO(도메인)` — HTTPS 자물쇠 + SPA 로드  📸
- [ ] 로그인 → 관계 선택 → 수신 메시지 → **RAG+GPT 추천 답변** → 전송 → 텔레그램 반영  📸 (+ 화면 녹화)
- [ ] 인증서 발급자 = Let's Encrypt (`curl -vI` 또는 브라우저 인증서 뷰어)  📸
- [ ] `docker stats` 스냅샷 (embedding RAM)  📸

---

## 7. 재배포 (나중에, 취업 활동 시)

```sh
# 노트북: 새 이미지 push
export IMAGE_TAG=$(git rev-parse --short HEAD)
# ... 2.2 로그인 + 2.3 buildx --push 반복 ...
aws ssm put-parameter --name /likemelikeme/prod/IMAGE_TAG --type String --value $IMAGE_TAG --overwrite

# EC2:
./scripts/fetch-secrets.sh
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --pull always
```

인프라 자체가 없으면 `cd infra && terraform apply` 부터.

---

## 8. Teardown (비용 0 복귀)

```sh
cd infra && terraform destroy        # EC2 + EIP + SG + IAM 프로파일 삭제
# 📸 destroy 출력
```

- [ ] EC2 콘솔 — 실행 중 인스턴스 없음  📸
- [ ] EIP — 해제됨 (미연결 EIP 는 시간당 과금)  📸
- [ ] ECR — 유지할지 결정. 삭제 시: `aws ecr delete-repository --repository-name likeme-api --force` (x3)
- [ ] SSM 파라미터 — 유지해도 무료. 정리 시 `aws ssm delete-parameters`
- [ ] EBS 볼륨/스냅샷 없음 확인
- [ ] 다음 날 Billing → Cost Explorer → $0 수렴  📸

> 유지 시 비용: EBS(월 $2~3) + EIP 미연결(월 $3.6). 인스턴스 stop 만으로는 이 둘이 남으므로,
> 상시 비용 0 을 원하면 `terraform destroy` 로 전부 삭제.

---

## 9. 트러블슈팅

| 증상 | 원인/조치 |
|---|---|
| Caddy 인증서 발급 실패 | 도메인 A 레코드가 EIP 를 안 가리킴 / SG 80 미개방 / `SITE_ADDRESS` 불일치. `docker compose logs web` |
| api `migrate deploy` 실패 | `.env` 의 `DATABASE_URL` 이 `@db:5432` 인지, db healthy 인지 확인 |
| 프론트에서 API 404/CORS | 프로덕션은 same-origin — CORS 무관. Caddyfile 의 `@api path` 목록에 해당 prefix 있는지 확인 |
| embedding OOM (`Exited 137`) | t3.small(2GB)+swap 필요. `free -h` 확인, swap 없으면 생성 |
| ECR pull 권한 오류 | 인스턴스 프로파일에 `ecr:GetAuthorizationToken` 등 + `docker login` 했는지 |
| api 가 `P3018`/`P3009` 로 재시작 반복 | 깨끗한 DB 에서 마이그레이션 재생 실패. `20251111151850_set_vector_dimensions_before_hnsw` 가 있는 이미지(`987809f-r2` 이후)면 발생하지 않음. 이전 이미지면 아래 10절 참고 |
| 화면이 "관계 미설정", 콘솔 `y.find is not a function` | Caddy 가 `/relationships` 를 api 로 안 보냄(수정됨) 또는 브라우저에 캐시된 이전 응답 → 시크릿 창에서 확인 / 사이트 데이터 삭제 |

---

## 10. 실제 실행(2026-11-12)에서 달라진 점

위 1~9절은 "준비" 단계에 쓴 런북이다. 실제로 돌려 보고 바뀐 것만 정리한다. 상세 기록은 `docs/REFACTORING_LOG.md`.

**자격 증명·도구 (Windows)**
- `aws login` 사용 시 Terraform 은 그 자격을 못 읽는다 → `aws configure export-credentials --profile <p> --format powershell | Invoke-Expression`.
- Git Bash 에서 `/likemelikeme/prod/…` 같은 인자는 경로로 변환된다 → `MSYS_NO_PATHCONV=1`.
- Windows 에서 `docker login`(ECR)이 `The stub received bad data` 로 실패하고 push 가 `403` 이 된다 →
  임시 `DOCKER_CONFIG`(credsStore 제거) + PATH 에서 `docker-credential-*` 가 안 보이는 환경에서 `docker.exe` 실행. 끝나면 폴더 삭제.
- 2.3 의 buildx 결과 태그는 **Image Index** 라 ECR 기본 스캔이 거부된다. 인덱스의 `linux/amd64` 자식 digest 로 스캔한다.
- 태그는 `<git SHA>-r<N>` 형태로 썼다(예: `987809f-r2`). api·web 만 다시 빌드한 경우 embedding 은 같은 이미지에
  새 태그만 붙인다(`aws ecr batch-get-image` → `put-image`). `IMAGE_TAG` 는 세 이미지가 공유하므로 SSM 값 하나만 바꾸면 된다.

**서버에 저장소 clone 이 필요 없다**
- 서버에 필요한 파일은 `docker-compose.yml`, `docker-compose.prod.yml`, `scripts/fetch-secrets.sh` 셋뿐이다(compose 는 이미지를 pull 만 함).
  GitHub 자격 증명을 서버에 두지 않는다. 최초 전달은 `scp`(22번이 열려 있을 때)로 했다.

**접속·배포는 SSH 대신 SSM**
- 22번은 기본으로 닫는다(`my_ip=""`). 순서와 에이전트 주의점은 `infra/README.md`.
- 원격 실행은 `aws ssm send-command --document-name AWS-RunShellScript`. **root 로 실행**되므로, `.env` 소유권이 root 로
  바뀌지 않게 `sudo -u ec2-user -H bash` 로 감싼다. 스크립트가 길면 base64 로 전달한다.
  ```sh
  # 재배포 (IMAGE_TAG 를 SSM 에서 바꾼 뒤)
  fetch-secrets.sh → ECR 로그인 → docker compose … up -d --pull always → ps
  ```

**데이터**
- 서버 DB 는 비어서 시작한다. 데모는 **가상 상대·가상 메시지 + 규칙으로 걸러낸 말투 샘플**을 `psql \copy` 로 적재했다
  (사용자 계정은 웹에서 가입 → 스크립트가 그 사용자에 연결, 재실행 가능). 실제 대화 원본은 올리지 않는다.
- 텔레그램을 쓰지 않으면 SSM 의 `TELEGRAM_BOT_TOKEN`·`DEFAULT_USER_ID` 를 삭제하고 `fetch-secrets.sh` → api 재생성
  (둘 다 비어 있으면 봇만 비활성으로 부팅). 단, 웹의 "AI 추천"은 DB 에 저장된 수신 메시지가 있어야 동작한다.

**api 가 `P3018` 로 죽을 때(이전 이미지)**: 컬럼 차원 지정 후 실패 기록 해제.
```sh
docker exec chatbot_db psql -U admin -d chatbot_db -c "ALTER TABLE tone_samples ALTER COLUMN embedding TYPE vector(768); \
  ALTER TABLE knowledge_chunks ALTER COLUMN embedding TYPE vector(768); ALTER TABLE message_embeddings ALTER COLUMN embedding TYPE vector(768);"
docker compose … run --rm --no-deps --entrypoint ./node_modules/.bin/prisma api migrate resolve --rolled-back 20251111151900_add_hnsw_indexes_on_vectors
```

**Teardown 체크리스트(추가분)**: `terraform destroy` 후 ① EC2·EIP·SG·IAM 역할 없음 확인 ② IAM 사용자 액세스 키 삭제·관리자 권한 회수
③ ECR·SSM 유지/삭제 결정 ④ DuckDNS 도메인 정리 ⑤ 다음 날 Cost Explorer.
