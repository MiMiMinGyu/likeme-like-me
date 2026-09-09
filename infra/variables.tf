variable "region" {
  description = "AWS 리전"
  type        = string
  default     = "ap-northeast-2" # 서울
}

variable "instance_type" {
  description = "EC2 인스턴스 타입. embedding(torch) 때문에 2GB 이상 필요"
  type        = string
  default     = "t3.small"
}

variable "key_name" {
  description = "SSH 접속용 EC2 키페어 이름 (콘솔/CLI 에서 미리 생성 또는 import)"
  type        = string
}

variable "my_ip" {
  description = "SSH(22) 를 허용할 내 공인 IP. CIDR 표기 (예: 1.2.3.4/32)"
  type        = string
}

variable "ssm_prefix" {
  description = "시크릿을 담은 SSM Parameter Store 경로 접두어"
  type        = string
  default     = "/likemelikeme/prod"
}

variable "ecr_repo_names" {
  description = "이 인스턴스가 pull 할 ECR 리포지토리 이름들"
  type        = list(string)
  default     = ["likeme-api", "likeme-web", "likeme-embedding"]
}

variable "root_volume_gb" {
  description = "루트 EBS 크기(GB). 이미지 3개(api 1.3G + embedding 2.5G + web) + DB 볼륨 여유"
  type        = number
  default     = 30
}

variable "swap_gb" {
  description = "스왑 파일 크기(GB). t3.small(2GB) 에서 embedding OOM 방지"
  type        = number
  default     = 2
}
