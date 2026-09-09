# infra/ — v3-aws Terraform

단일 EC2 위에서 `docker compose` 로 전체 스택을 돌리기 위한 **최소** 인프라.
관리형 서비스(RDS·ALB·ECS)를 쓰지 않아 상시 비용이 가장 낮고, `terraform destroy`
한 번으로 전부 사라진다.

## 만들어지는 것

| 리소스 | 비고 |
|---|---|
| Security Group | 22(내 IP만), 80, 443, 아웃바운드 전체 |
| IAM Role + Instance Profile | SSM 읽기(`${ssm_prefix}/*`) + KMS Decrypt(SSM 경유) + ECR pull(지정 리포만) |
| EC2 (t3.small, AL2023, gp3 30GB, IMDSv2) | user-data 로 docker/compose/스왑 설치 |
| Elastic IP | 도메인 A 레코드용 고정 IP |

default VPC/서브넷을 그대로 쓴다 (별도 네트워크 없음).

## 사전 준비

- AWS CLI 프로파일 (IAM 사용자, `ap-northeast-2`)
- EC2 **키페어**를 미리 생성/임포트 → 이름을 `key_name` 으로 전달
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
my_ip    = "$(curl -s https://checkip.amazonaws.com)/32"
EOF

terraform apply
# outputs: public_ip, ssh, ssm_prefix

terraform output -raw public_ip     # → DuckDNS/도메인 A 레코드에 입력
```

이후 배포는 `docs/DEPLOY.md` 5절.

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
```
