# Windows 작업 환경 잡메모

개인 학습 메모. 이번 배포를 Windows 11(PowerShell, Git Bash, Docker Desktop)에서 하면서 막힌 것 네 가지. 환경에 따라 다를 수 있음.
작성 시점에 설치된 버전: Docker 28.5.1, Terraform 1.17.1(AWS provider 5.100.0, 잠금 파일 기준), AWS CLI 2.36.42, Git 2.46.2.windows.1.

## 1. `terraform plan`이 보안 그룹 설명을 거부함

- 증상: `terraform plan`이 보안 그룹의 `description`을 거부함. 설명에 한글과 `'`가 들어 있었음.
- 알게 된 것: EC2 API 문서(CreateSecurityGroup)는 `GroupDescription`을 최대 255자로 제한하고, 영문자·숫자·공백과 일부 기호만 허용한다고 적음. 한글과 `'`는 그 목록에 없음([CreateSecurityGroup](https://docs.aws.amazon.com/AWSEC2/latest/APIReference/API_CreateSecurityGroup.html)).
- 해결: 설명을 영문 ASCII로 바꿈. 배포 도중이 아니라 plan 단계에서 걸림.

## 2. Git Bash가 `/likemelikeme/prod/…`를 경로로 바꿈

- 증상: Git Bash에서 SSM 파라미터를 등록하자 `fully qualified name` 오류가 남. 파라미터 이름이 `/likemelikeme/prod/…`처럼 `/`로 시작함.
- 알게 된 것: MSYS2 문서는 명령줄 인자 중 유닉스 경로처럼 보이는 것이 Windows 경로로 자동 변환된다고 설명함([Filesystem Paths](https://www.msys2.org/docs/filesystem-paths/)). Git for Windows 릴리스 노트의 Known issues는 슬래시로 시작하는 인자에 이 변환이 일어난다며 `MSYS_NO_PATHCONV`를 임시로 설정하라고 안내하고, 첫 슬래시를 두 번 쓰는 방법도 소개함([Release Notes](https://github.com/git-for-windows/build-extra/blob/main/ReleaseNotes.md)).
- 해결: `MSYS_NO_PATHCONV=1`을 붙여 실행함.

## 3. Terraform이 `aws login` 자격을 못 읽음

- 증상: `aws login`으로 로그인했는데 Terraform이 자격 증명을 찾지 못함.
- 알게 된 것: AWS CLI 문서는 오래된 SDK나 개발 도구는 콘솔 자격 증명을 지원하지 않을 수 있다고 적고, 우회로 CLI를 `credential_process` 제공자로 설정하는 방법을 안내함([Login for AWS local development using console credentials](https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-sign-in.html)). Terraform AWS provider는 환경 변수를 자격 증명 탐색 순서의 한 단계로 둠([Terraform AWS provider](https://registry.terraform.io/providers/hashicorp/aws/latest/docs)).
- 해결: `aws configure export-credentials --format powershell | Invoke-Expression`으로 임시 자격을 환경 변수에 넣음. `powershell`은 CLI 문서의 지원 형식 중 하나임([export-credentials](https://docs.aws.amazon.com/cli/latest/reference/configure/export-credentials.html)). 장기 액세스 키는 비활성화한 상태였음.

## 4. Windows에서 ECR push가 403

- 증상: `docker login`이 `The stub received bad data`로 실패했고, 이어서 push가 `403`이 됨.
- 알게 된 것: ECR 문서는 일부 Docker for Windows 버전의 `wincred` 자격 증명 관리자가 `get-login-password`로 만든 로그인 명령을 제대로 처리하지 못하는 버그가 있다고 설명하며, 레지스트리 인자에서 `https://`를 빼는 우회법을 안내함([Troubleshooting Docker commands in Amazon ECR](https://docs.aws.amazon.com/AmazonECR/latest/userguide/common-errors-docker.html)). Docker 문서는 자격 증명 저장소가 없으면 `config.json`에 base64로 저장하며 저장소를 쓰는 것보다 덜 안전하다고 적음([docker login](https://docs.docker.com/reference/cli/docker/login/)).
- 해결: 임시 `DOCKER_CONFIG` 폴더(`credsStore` 없음)를 만들고, `docker-credential-*`가 PATH에서 보이지 않는 환경에서 `docker.exe`를 실행해 파일 저장으로 우회함. 끝난 뒤 임시 폴더는 삭제함.

## 한계

- 네 건 모두 원인을 실험으로 가르지는 않았고, 문서의 설명과 우회가 통한 결과로 정리한 것임. 이번 배포의 목적이 파이프라인을 끝까지 돌리는 것이어서, 우회가 통하면 원인 규명까지는 하지 않았음.
- 4번의 `The stub received bad data` 메시지를 직접 설명하는 문서는 찾지 못함. `wincred` 버그가 원인이라는 것은 ECR 문서의 설명과 우회가 통한 결과에 기댄 추정임.
- 도구 버전은 현재 설치된 값이고, 작업 당시와 같은지는 기록이 없음. 문서 내용도 버전에 따라 달라질 수 있음.
