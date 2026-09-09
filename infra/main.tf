# ==============================================================================
# LikemeLikeMe — v3-aws 최소 인프라
#
#   default VPC + 보안그룹 1 + EC2 1 + EIP 1 + IAM 인스턴스 프로파일.
#   서버 안에서 docker compose 로 전체 스택을 돌린다 (관리형 서비스 없음 = 최저비용).
#
#   terraform apply  후  outputs 의 ssh 명령으로 접속 → docs/DEPLOY.md 5절.
#   철거:  terraform destroy   (EIP 포함 전부 삭제 → 상시 비용 0)
# ==============================================================================

data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

# default VPC (별도 네트워크를 만들지 않는다 — 데모 규모)
data "aws_vpc" "default" {
  default = true
}

# Amazon Linux 2023 최신 x86_64
data "aws_ami" "al2023" {
  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = ["al2023-ami-*-x86_64"]
  }
  filter {
    name   = "architecture"
    values = ["x86_64"]
  }
  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
}

# ------------------------------------------------------------------ 보안 그룹
resource "aws_security_group" "app" {
  name        = "likemelikeme-app"
  description = "SSH(내 IP), HTTP, HTTPS"
  vpc_id      = data.aws_vpc.default.id

  ingress {
    description = "SSH (내 IP 만)"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = [var.my_ip]
  }
  ingress {
    description = "HTTP (Caddy — Let's Encrypt HTTP-01 포함)"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
  ingress {
    description = "HTTPS"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
  egress {
    description = "전체 아웃바운드 (ECR·SSM·OpenAI·Let's Encrypt)"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

# ------------------------------------------------------------------ IAM (최소 권한)
data "aws_iam_policy_document" "assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["ec2.amazonaws.com"]
    }
  }
}

data "aws_iam_policy_document" "app" {
  # 시크릿 읽기 — 지정 접두어 하위만
  statement {
    sid       = "SsmReadPrefix"
    actions   = ["ssm:GetParametersByPath", "ssm:GetParameters", "ssm:GetParameter"]
    resources = ["arn:aws:ssm:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:parameter${var.ssm_prefix}/*"]
  }
  # SecureString 복호화 — SSM 경유 호출로 한정
  statement {
    sid       = "KmsDecryptViaSsm"
    actions   = ["kms:Decrypt"]
    resources = ["*"]
    condition {
      test     = "StringEquals"
      variable = "kms:ViaService"
      values   = ["ssm.${data.aws_region.current.name}.amazonaws.com"]
    }
  }
  # ECR 토큰 — 리소스 한정 불가(AWS 사양)
  statement {
    sid       = "EcrAuth"
    actions   = ["ecr:GetAuthorizationToken"]
    resources = ["*"]
  }
  # ECR pull — 이 프로젝트 리포지토리만
  statement {
    sid = "EcrPull"
    actions = [
      "ecr:BatchCheckLayerAvailability",
      "ecr:GetDownloadUrlForLayer",
      "ecr:BatchGetImage",
    ]
    resources = [
      for name in var.ecr_repo_names :
      "arn:aws:ecr:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:repository/${name}"
    ]
  }
}

resource "aws_iam_role" "app" {
  name               = "likemelikeme-ec2"
  assume_role_policy = data.aws_iam_policy_document.assume.json
}

resource "aws_iam_role_policy" "app" {
  name   = "likemelikeme-ec2-inline"
  role   = aws_iam_role.app.id
  policy = data.aws_iam_policy_document.app.json
}

resource "aws_iam_instance_profile" "app" {
  name = "likemelikeme-ec2"
  role = aws_iam_role.app.name
}

# ------------------------------------------------------------------ EC2 + EIP
resource "aws_instance" "app" {
  ami                    = data.aws_ami.al2023.id
  instance_type          = var.instance_type
  key_name               = var.key_name
  vpc_security_group_ids = [aws_security_group.app.id]
  iam_instance_profile   = aws_iam_instance_profile.app.name

  user_data = templatefile("${path.module}/user-data.sh", {
    swap_gb = var.swap_gb
  })

  root_block_device {
    volume_type = "gp3"
    volume_size = var.root_volume_gb
    encrypted   = true
  }

  metadata_options {
    http_tokens   = "required" # IMDSv2 강제
    http_endpoint = "enabled"
  }

  tags = { Name = "likemelikeme" }
}

resource "aws_eip" "app" {
  instance = aws_instance.app.id
  domain   = "vpc"
  tags     = { Name = "likemelikeme" }
}
