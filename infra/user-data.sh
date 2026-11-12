#!/bin/bash
# EC2 최초 부팅 1회 실행 (Amazon Linux 2023).
#   - docker + compose 플러그인 설치
#   - 스왑 파일 생성 (t3.small 2GB 에서 embedding OOM 방지)
#   - 앱 디렉터리 준비
# 저장소 체크아웃/배포는 사람이 SSH 로 (docs/DEPLOY.md 5절) — private 레포 인증 때문.
set -eux

# --- docker ---
dnf -y update
dnf -y install docker git
systemctl enable --now docker
usermod -aG docker ec2-user

# --- docker compose v2 플러그인 (AL2023 docker 패키지엔 미포함) ---
CLI_PLUGINS=/usr/libexec/docker/cli-plugins
mkdir -p "$CLI_PLUGINS"
COMPOSE_VERSION=v2.40.2
curl -sSL "https://github.com/docker/compose/releases/download/$${COMPOSE_VERSION}/docker-compose-linux-x86_64" \
  -o "$CLI_PLUGINS/docker-compose"
chmod +x "$CLI_PLUGINS/docker-compose"

# --- SSM 에이전트 (Session Manager / Run Command) ---
# AL2023 minimal AMI 에는 에이전트가 없다. 설치하지 않으면 22번을 닫은 뒤 접속할 방법이 없다.
dnf -y install amazon-ssm-agent
systemctl enable --now amazon-ssm-agent

# --- 스왑 ---
if [ ! -f /swapfile ]; then
  dd if=/dev/zero of=/swapfile bs=1M count=$(( ${swap_gb} * 1024 ))
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

# --- 앱 디렉터리 ---
install -d -o ec2-user -g ec2-user /home/ec2-user/likemelikeme

echo "user-data 완료: docker $(docker --version), compose $(docker compose version)"
