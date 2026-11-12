# syntax=docker/dockerfile:1

# ==============================================================================
# LikemeLikeMe Web (React 19 / Vite 7) — 빌드 후 Caddy 로 서빙
#   build 컨텍스트: apps/web
#   결과: 정적 SPA + Caddy(리버스 프록시 겸용). compose 에서 api 앞단에 둔다.
# ==============================================================================

# ------------------------------------------------------------------ build stage
# 베이스 이미지는 digest 로 고정 (api Dockerfile 과 동일 정책). 갱신:
#   docker manifest inspect node:24-bookworm-slim
# 고정 시각: 2026-11-12 (스캔 취약점 감소 목적으로 최신 digest 갱신; 이전: 2026-09-09)
FROM node:24-bookworm-slim@sha256:dc26ae92c9fb15cf6b1d63e20f0944b2efe0f115b20e00be48fb23fceb061c54 AS build

WORKDIR /app

# 의존성 레이어 캐시: lock 먼저 복사
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# 소스 복사 후 프로덕션 빌드 → /app/dist
#   .env.production (VITE_API_BASE_URL 빈 값) 이 자동 로드된다.
COPY . .
RUN npm run build

# ---------------------------------------------------------------- runtime stage
# Caddy: 정적 파일 서버 + 자동 HTTPS. 갱신: docker manifest inspect caddy:2-alpine
FROM caddy:2-alpine@sha256:78bd35025c7ba85961dd149ae670315129954e77abe2383ac47c89106b35ade9

COPY Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/dist /srv

# 80(HTTP) + 443(HTTPS, 도메인 모드에서 Let's Encrypt). compose 에서 매핑.
EXPOSE 80 443

# 이미지 기본 CMD(caddy run --config /etc/caddy/Caddyfile) 를 그대로 사용.
