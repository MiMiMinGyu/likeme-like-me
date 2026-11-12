# syntax=docker/dockerfile:1

# ==============================================================================
# LikemeLikeMe API (NestJS 11) — 멀티스테이지 이미지
#   build 컨텍스트: apps/api  (이 디렉터리에 자체 package-lock.json 이 있음)
#   런타임: Node 24 (현재 Active LTS, 로컬 개발 버전과 일치)
#
#   로드맵 3단계. DB(chatbot_db)·임베딩(likeme-embedding)은 아직 별도 컨테이너로 두고
#   이 이미지는 API 프로세스만 담는다. 루트 compose 통합은 4단계(v2-compose).
# ==============================================================================

# ------------------------------------------------------------------ build stage
# 베이스 이미지는 digest 로 고정한다. 태그(24-bookworm-slim)는 재배포 시점마다
# 다른 이미지를 가리킬 수 있어, 몇 달 뒤 재배포해도 동일 빌드가 나오도록 못박음.
#   digest 갱신: docker manifest inspect node:24-bookworm-slim
#   고정 시각: 2026-11-12 (ECR 스캔의 취약점 수를 줄이려고 같은 태그의 최신 digest 로 갱신; 이전: 2026-09-09)
FROM node:24-bookworm-slim@sha256:dc26ae92c9fb15cf6b1d63e20f0944b2efe0f115b20e00be48fb23fceb061c54 AS build

# bcrypt 네이티브 컴파일용 툴체인 + Prisma 엔진이 링크하는 openssl
RUN apt-get update && apt-get install -y --no-install-recommends \
      python3 make g++ openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 의존성 레이어: lock + prisma 스키마 + prisma.config.ts 만 먼저 복사해
# 소스만 바뀔 때 npm ci 캐시가 살아남게 한다.
COPY package.json package-lock.json prisma.config.ts ./
COPY prisma ./prisma

# npm 11 은 의존성의 install-script 를 기본 차단한다. bcrypt 네이티브 빌드는
# package.json#allowScripts 로 승인돼 있지만, 해석된 버전이 키와 어긋나도
# 확실히 빌드되도록 npm rebuild 로 한 번 더 못박는다.
# 루트 프로젝트 자신의 postinstall(prisma generate)은 차단 대상이 아니라 여기서 실행됨.
RUN npm ci --no-audit --no-fund \
 && npm rebuild bcrypt

# 나머지 소스 복사 후 컴파일 → dist/main.js
COPY . .
RUN npm run build \
 && npm prune --omit=dev \
 && npm rebuild bcrypt

# ---------------------------------------------------------------- runtime stage
# build 스테이지와 동일 digest (위 주석 참고)
FROM node:24-bookworm-slim@sha256:dc26ae92c9fb15cf6b1d63e20f0944b2efe0f115b20e00be48fb23fceb061c54 AS runtime

# Prisma query engine 가 런타임에 openssl 을 필요로 함
RUN apt-get update && apt-get install -y --no-install-recommends \
      openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production \
    PORT=3000

WORKDIR /app

# prune 된 프로덕션 node_modules + 빌드 산출물 + 마이그레이션에 필요한 파일만
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/prisma.config.ts ./prisma.config.ts
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh

RUN chmod +x /usr/local/bin/docker-entrypoint.sh \
 && chown -R node:node /app
USER node

EXPOSE 3000

# 헬스체크는 별도 패키지 없이 node 내장 http 로 (slim 에 curl/wget 없음)
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:'+(process.env.PORT||3000)+'/',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

# entrypoint 가 prisma migrate deploy 를 돌린 뒤 CMD 를 exec 한다
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "--no-warnings=DEP0040", "dist/main.js"]
