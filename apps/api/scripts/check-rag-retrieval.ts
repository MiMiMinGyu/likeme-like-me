/**
 * RAG 검색 점검: 임의의 메시지를 EmbeddingService(KoSimCSE 768)로 임베딩하고
 * getSimilarContext 와 동일한 pgvector 코사인 검색으로 유사 tone_sample 을 뽑아본다.
 *
 *   npx ts-node scripts/check-rag-retrieval.ts "내일 시간 되면 잠깐 볼 수 있을까?"
 *
 * 전제: apps/embedding 컨테이너(EMBEDDING_URL), DB(.env DATABASE_URL).
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const EMBEDDING_URL = process.env.EMBEDDING_URL ?? 'http://localhost:8000';
const LIMIT = Number(process.env.LIMIT ?? 15);

async function embed(text: string): Promise<number[]> {
  const r = await fetch(`${EMBEDDING_URL}/embed`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ texts: [text] }),
  });
  if (!r.ok) throw new Error(`embed ${r.status}: ${await r.text()}`);
  return (await r.json()).embeddings[0];
}

async function main() {
  const query = process.argv[2];
  if (!query) {
    console.error('사용법: npx ts-node scripts/check-rag-retrieval.ts "<메시지>"');
    process.exit(1);
  }

  // tone_samples 를 보유한 사용자 (단일 사용자 전제)
  const [{ user_id }] = await prisma.$queryRaw<Array<{ user_id: string }>>`
    SELECT user_id FROM tone_samples GROUP BY user_id ORDER BY count(*) DESC LIMIT 1
  `;

  const vec = `[${(await embed(query)).join(',')}]`;
  const rows = await prisma.$queryRawUnsafe<
    Array<{ text: string; politeness: string; vibe: string; sim: number }>
  >(
    `SELECT text, politeness, vibe,
            round((1 - (embedding <=> '${vec}'::vector))::numeric, 3)::float8 AS sim
     FROM tone_samples
     WHERE user_id = '${user_id}'::uuid AND embedding IS NOT NULL
     ORDER BY embedding <=> '${vec}'::vector
     LIMIT ${LIMIT}`,
  );

  console.log(`\nQUERY: ${query}\n`);
  rows.forEach((r, i) =>
    console.log(
      `${String(i + 1).padStart(2)}. ${r.sim.toFixed(3)}  [${r.politeness}/${r.vibe}]  ${r.text}`,
    ),
  );
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
