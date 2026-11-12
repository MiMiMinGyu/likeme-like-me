-- 마이그레이션 재현성 보강: 깨끗한 DB 에서 처음부터 재생해도 HNSW 인덱스 생성이 실패하지 않게 한다.
--
-- 문제: init 마이그레이션이 embedding 을 차원 없는 `vector` 로 만들고, 바로 뒤
--   20251111151900_add_hnsw_indexes_on_vectors 가 HNSW 인덱스를 만든다. pgvector 의 HNSW 는
--   차원이 필수라 `ERROR: column does not have dimensions` (P3018) 로 실패한다.
--   차원을 지정하는 20260903120000_embedding_dim_768 은 그 뒤 순서라 소용이 없었다.
--   (기존 DB 는 차원이 마이그레이션 밖에서 먼저 적용돼 있어 이 문제가 가려져 있었다.)
--
-- 해결: HNSW 직전(151900 보다 앞선 151850)에 차원을 지정한다.
--   * 이미 적용된 이력은 수정하지 않는다 (체크섬 유지).
--   * 멱등: 컬럼에 이미 차원이 있으면(기존 DB) 아무 것도 하지 않는다.
--   * 768 은 20260903120000 이 최종적으로 쓰는 차원(KoSimCSE)과 같다.

DO $$
DECLARE
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['tone_samples', 'knowledge_chunks', 'message_embeddings'] LOOP
    IF (
      SELECT a.atttypmod
      FROM pg_attribute a
      WHERE a.attrelid = format('public.%I', tbl)::regclass
        AND a.attname = 'embedding'
    ) = -1 THEN
      EXECUTE format('ALTER TABLE public.%I ALTER COLUMN embedding TYPE vector(768)', tbl);
    END IF;
  END LOOP;
END
$$;
