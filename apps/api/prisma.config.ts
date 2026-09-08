import * as path from 'node:path';
import 'dotenv/config';
import { defineConfig } from 'prisma/config';

/**
 * Prisma CLI 설정 (schema 위치 + seed 커맨드).
 *
 * 왜 파일로 뺐나:
 *  - `package.json#prisma` 필드는 deprecated (Prisma 7 에서 제거 예정) → 경고 제거.
 *  - 설정 파일이 있으면 Prisma CLI 가 `.env` 를 자동 로드하지 않으므로
 *    여기서 `dotenv/config` 를 직접 import 해 DATABASE_URL 등을 채운다.
 *
 * NestJS 런타임의 env 검증은 src/config/env.validation.ts 가 담당 (별개).
 */
export default defineConfig({
  schema: path.join('prisma', 'schema.prisma'),
  migrations: {
    seed: 'ts-node prisma/seed.ts',
  },
});
