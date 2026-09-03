-- 임베딩 모델 교체: OpenAI text-embedding-3-small(1536) → BM-K/KoSimCSE-roberta-multitask(768)
--
-- 기존 OpenAI 벡터는 새 모델의 벡터 공간과 호환되지 않으므로 폐기하고,
-- 별도 스크립트(scripts/reembed-tone-samples.ts)로 KoSimCSE 벡터를 다시 채운다.
--
-- HNSW 인덱스는 Prisma 가 관리하지 않는 raw SQL 이라(Unsupported 컬럼) 여기서 직접 처리한다.
-- 이 파일은 psql 로 직접 적용 후 `prisma migrate resolve --applied` 로 이력에 기록한다
-- (기존 마이그레이션 이력이 shadow DB 재생 불가라 `migrate dev` 사용 불가).

-- 1. 기존 벡터 제거 (tone_samples 17,943행 / 나머지 두 테이블은 이미 비어 있음)
UPDATE "tone_samples" SET "embedding" = NULL;

-- 2. 차원 의존 인덱스 제거
DROP INDEX IF EXISTS "idx_tone_samples_embedding";
DROP INDEX IF EXISTS "idx_knowledge_chunks_embedding";
DROP INDEX IF EXISTS "idx_message_embeddings_embedding";

-- 3. 컬럼 차원 변경 1536 → 768 (전 행 NULL 이라 무손실)
ALTER TABLE "tone_samples"       ALTER COLUMN "embedding" TYPE vector(768);
ALTER TABLE "knowledge_chunks"   ALTER COLUMN "embedding" TYPE vector(768);
ALTER TABLE "message_embeddings" ALTER COLUMN "embedding" TYPE vector(768);

-- 4. HNSW 인덱스 재생성 (기존과 동일 파라미터: cosine, m=16, ef_construction=64)
CREATE INDEX "idx_tone_samples_embedding"
  ON "tone_samples" USING hnsw ("embedding" vector_cosine_ops) WITH (m = 16, ef_construction = 64);
CREATE INDEX "idx_knowledge_chunks_embedding"
  ON "knowledge_chunks" USING hnsw ("embedding" vector_cosine_ops) WITH (m = 16, ef_construction = 64);
CREATE INDEX "idx_message_embeddings_embedding"
  ON "message_embeddings" USING hnsw ("embedding" vector_cosine_ops) WITH (m = 16, ef_construction = 64);
