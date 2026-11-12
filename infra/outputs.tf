output "public_ip" {
  description = "고정 공인 IP (EIP). DuckDNS/도메인 A 레코드를 이 값으로."
  value       = aws_eip.app.public_ip
}

output "instance_id" {
  value = aws_instance.app.id
}

output "ssh" {
  description = "SSH 접속 명령 (my_ip 를 비우면 22번이 닫혀 있어 쓸 수 없다)"
  value       = "ssh -i ~/.ssh/${var.key_name}.pem ec2-user@${aws_eip.app.public_ip}"
}

output "ssm_session" {
  description = "SSM Session Manager 접속 명령 (SSH 키·22번 포트 불필요)"
  value       = "aws ssm start-session --target ${aws_instance.app.id} --profile likemelikeme"
}

output "ssm_prefix" {
  value = var.ssm_prefix
}
