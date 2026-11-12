# infra/ — v3-aws Terraform

단일 EC2 위에서 `docker compose` 로 전체 스택을 돌리기 위한 **최소** 인프라.
관리형 서비스(RDS·ALB·ECS)를 쓰지 않아 상시 비용이 가장 낮고, `terraform destroy`
한 번으로 전부 사라진다.

## 만들어지는 것

| 리소스 | 비고 |
|---|---|
| Security Group | 80, 443, 아웃바운드 전체. **22번은 `my_ip` 를 줄 때만 열린다(비상용), 기본은 닫힘** |
| IAM Role + Instance Profile | SSM 읽기(`${ssm_prefix}/*`) + KMS Decrypt(SSM 경유) + ECR pull(지정 리포만) + Session Manager 용 관리형 `AmazonSSMManagedInstanceCore` |
| EC2 (t3.small, AL2023, gp3 30GB, IMDSv2) | user-data 로 docker/compose/스왑 설치 |
| Elastic IP | 도메인 A 레코드용 고정 IP |

default VPC/서브넷을 그대로 쓴다 (별도 네트워크 없음).

## 사전 준비

- AWS CLI 프로파일 (IAM 사용자, `ap-northeast-2`). `aws login` 을 쓰면 Terraform 이 그 자격을 읽지 못하므로
  실행 전에 임시 자격을 내보낸다 (PowerShell):
  ```powershell
  aws configure export-credentials --profile <프로파일> --format powershell | Invoke-Expression
  ```
- PC 에 `session-manager-plugin` (`aws ssm start-session` 용)
- EC2 **키페어**를 미리 생성/임포트 → 이름을 `key_name` 으로 전달 (인스턴스에 연결되는 값이라 바꾸면 서버가 교체된다)
  ```sh
  aws ec2 create-key-pair --key-name likemelikeme \
    --query KeyMaterial --output text > ~/.ssh/likemelikeme.pem
  chmod 600 ~/.ssh/likemelikeme.pem
  ```
- ECR 리포지토리 3개는 `docs/DEPLOY.md` 2절에서 별도 생성 (Terraform 관리 밖 —
  이미지 수명주기가 인프라와 다르고, destroy 시 이미지가 날아가면 안 되므로)

## 사용

```sh
cd infra
terraform init

cat > terraform.tfvars <<EOF
key_name = "likemelikeme"
# my_ip  : 비상용 SSH(22) 를 허용할 내 공인 IP. 비우면(기본) 22번 규칙이 없다.
my_ip    = "$(curl -s https://checkip.amazonaws.com)/32"
EOF

terraform apply
# outputs: public_ip, instance_id, ssh, ssm_session, ssm_prefix

terraform output -raw public_ip     # → DuckDNS/도메인 A 레코드에 입력
```

이후 배포는 `docs/DEPLOY.md` 5절.

### 22번을 닫는 순서 (잠금 방지)

1. `my_ip` 를 둔 채로 apply → SSM 권한이 붙고, 서버의 SSM 에이전트가 Online 이 된다.
   `aws ssm describe-instance-information` 에 나오고 `aws ssm start-session --target <instance_id>` 가 되는지 확인.
2. 그다음 `my_ip = ""` 로 apply → SG 의 22번 규칙만 제거된다 (`0 to add, 1 to change`).
   이 순서를 어기면 접속 수단이 사라질 수 있다.

참고: AL2023 **minimal** AMI 에는 SSM 에이전트가 없다. `user-data.sh` 가 설치하지만 user-data 는 최초 부팅 1회라,
이미 떠 있는 서버에는 수동 설치(`dnf install amazon-ssm-agent`)가 필요하다. 권한이 붙기 **전에** 에이전트가
시작되면 재시도를 약 28분 뒤로 미루므로, 권한 부여 후 `systemctl restart amazon-ssm-agent`.

## 철거

```sh
terraform destroy
```

EC2·EIP·SG·IAM 전부 삭제 → 상시 비용 0.
ECR 리포지토리와 SSM 파라미터는 이 스택 밖이라 남는다 (SSM 은 무료, ECR 은
`docs/DEPLOY.md` 8절대로 정리).

## 비용 (서울, 대략)

| | 24시간 | 시연 때만 (stop) |
|---|---|---|
| t3.small | ~$19/월 | 가동 시간분만 |
| gp3 30GB | ~$2.7/월 | 동일 (stop 해도 부과) |
| EIP | 연결 시 무료, 미연결 시 ~$3.6/월 | destroy 로 해제 |

→ 상시 비용 0 을 원하면 `stop` 이 아니라 `terraform destroy`.

## IAM 정책 요약 (least privilege)

```
ssm:GetParametersByPath / GetParameters / GetParameter
  └ arn:aws:ssm:<region>:<acct>:parameter/likemelikeme/prod/*
kms:Decrypt
  └ condition: kms:ViaService = ssm.<region>.amazonaws.com
ecr:GetAuthorizationToken            └ *  (AWS 사양상 리소스 한정 불가)
ecr:BatchGetImage / GetDownloadUrlForLayer / BatchCheckLayerAvailability
  └ repository/likeme-api, likeme-web, likeme-embedding
AmazonSSMManagedInstanceCore (AWS 관리형)
  └ Session Manager / Run Command 용. 에이전트가 요구하는 액션을 직접 줄이면 등록이 조용히 실패할 수
    있어 관리형을 선택했다. 사용자 정의 최소 정책은 후속 과제.
```
