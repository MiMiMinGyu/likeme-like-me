/**
 * tone_samples 재임베딩 스크립트.
 *
 * 임베딩 모델 교체(OpenAI 1536 → KoSimCSE 768)에 따라 embedding 이 NULL 로 비워진
 * tone_samples 행을 apps/embedding 서비스로 다시 임베딩한다.
 *
 *   실행:  npx ts-node scripts/reembed-tone-samples.ts
 *   전제:  apps/embedding 컨테이너가 EMBEDDING_URL 에서 응답 (기본 http://localhost:8000)
 *          DB 는 .env 의 DATABASE_URL
 *
 * 중단해도 안전: WHERE embedding IS NULL 만 처리하므로 다시 실행하면 남은 것부터 이어감.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const EMBEDDING_URL = process.env.EMBEDDING_URL ?? 'http://localhost:8000';
const BATCH_SIZE = Number(process.env.BATCH_SIZE ?? 200);
const EXPECTED_DIM = 768;

interface Row {
  id: string;
  text: string;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function embedBatch(texts: string[], attempt = 1): Promise<number[][]> {
  try {
    const res = await fetch(`${EMBEDDING_URL}/embed`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ texts }),
    });
    if (!res.ok) {
      throw new Error(`embed 실패 ${res.status}: ${await res.text()}`);
    }
    const json = (await res.json()) as { embeddings: number[][]; dim: number };
    if (json.dim !== EXPECTED_DIM) {
      throw new Error(`차원 불일치: ${json.dim} (기대 ${EXPECTED_DIM})`);
    }
    return json.embeddings;
  } catch (e) {
    if (attempt > 10) throw e;
    const wait = Math.min(30_000, 2_000 * attempt);
    console.warn(
      `  [retry ${attempt}] ${(e as Error).message} → ${wait / 1000}s 후 재시도 ` +
        `(컨테이너가 죽었으면 다른 터미널에서 docker start likeme-embedding)`,
    );
    await sleep(wait);
    return embedBatch(texts, attempt + 1);
  }
}

async function main() {
  // 서비스 헬스 체크
  const health = await fetch(`${EMBEDDING_URL}/health`).then((r) => r.json());
  console.log(`[embedding] ${EMBEDDING_URL} → ${JSON.stringify(health)}`);

  const [{ count: totalNull }] = await prisma.$queryRaw<
    Array<{ count: bigint }>
  >`SELECT COUNT(*) AS count FROM tone_samples WHERE embedding IS NULL`;
  const target = Number(totalNull);
  console.log(`[reembed] 대상(embedding IS NULL): ${target}행, 배치 ${BATCH_SIZE}\n`);

  let done = 0;
  const started = Date.now();

  while (true) {
    const rows = await prisma.$queryRaw<Row[]>`
      SELECT id, text FROM tone_samples
      WHERE embedding IS NULL
      ORDER BY created_at
      LIMIT ${BATCH_SIZE}
    `;
    if (rows.length === 0) break;

    const vectors = await embedBatch(rows.map((r) => r.text));

    // 배치를 한 트랜잭션으로 UPDATE
    await prisma.$transaction(
      rows.map((row, i) => {
        const vec = `[${vectors[i].join(',')}]`;
        return prisma.$executeRaw`
          UPDATE tone_samples SET embedding = ${vec}::vector WHERE id = ${row.id}::uuid
        `;
      }),
    );

    done += rows.length;
    const rate = done / ((Date.now() - started) / 1000);
    const eta = Math.round((target - done) / rate);
    console.log(
      `  ${done}/${target}  (${rate.toFixed(0)}/s, ETA ${eta}s)`,
    );
  }

  const [{ count: remaining }] = await prisma.$queryRaw<
    Array<{ count: bigint }>
  >`SELECT COUNT(*) AS count FROM tone_samples WHERE embedding IS NULL`;
  console.log(
    `\n[reembed] 완료. 처리 ${done}행, 남은 NULL ${Number(remaining)}행, ` +
      `소요 ${((Date.now() - started) / 1000).toFixed(1)}s`,
  );

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
