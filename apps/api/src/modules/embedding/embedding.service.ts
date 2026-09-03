import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface EmbedApiResponse {
  embeddings: number[][];
  model: string;
  dim: number;
}

/**
 * 자체 호스팅 한국어 임베딩 서비스(apps/embedding, KoSimCSE 768차원) 클라이언트.
 *
 * 기존 OpenaiService.createEmbedding(s) (text-embedding-3-small, 1536) 를 대체한다.
 * 한국어 문장 의미 유사도에 특화된 모델이라 말투 검색에 더 적합하고, 호출당 비용·
 * 네트워크(외부 API) 의존이 없다.
 */
@Injectable()
export class EmbeddingService {
  private readonly logger = new Logger(EmbeddingService.name);
  private readonly baseUrl: string;
  private readonly dim = 768;
  /** apps/embedding 서비스 내부 MAX_BATCH(64)에 맞춘 클라이언트측 청크 크기 */
  private readonly chunkSize = 64;

  constructor(config: ConfigService) {
    this.baseUrl = (
      config.get<string>('EMBEDDING_URL') ?? 'http://localhost:8000'
    ).replace(/\/$/, '');
    this.logger.log(`EmbeddingService → ${this.baseUrl} (dim ${this.dim})`);
  }

  /** 단일 텍스트 임베딩. 질의 시점(getSimilarContext)에서 사용. */
  async embed(text: string): Promise<number[]> {
    const [vec] = await this.embedMany([text], { retries: 2, baseDelayMs: 400 });
    return vec;
  }

  /** 다중 텍스트 임베딩. 대량 업로드(kakao) 시 사용. */
  async embedMany(
    texts: string[],
    opts: { retries?: number; baseDelayMs?: number } = {},
  ): Promise<number[][]> {
    const { retries = 5, baseDelayMs = 1000 } = opts;
    const out: number[][] = [];
    for (let i = 0; i < texts.length; i += this.chunkSize) {
      const chunk = texts.slice(i, i + this.chunkSize);
      out.push(...(await this.postEmbed(chunk, retries, baseDelayMs)));
    }
    return out;
  }

  private async postEmbed(
    texts: string[],
    retries: number,
    baseDelayMs: number,
    attempt = 1,
  ): Promise<number[][]> {
    try {
      const res = await fetch(`${this.baseUrl}/embed`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ texts }),
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${await res.text()}`);
      }
      const json = (await res.json()) as EmbedApiResponse;
      if (json.dim !== this.dim) {
        throw new Error(`dim mismatch: ${json.dim} (expected ${this.dim})`);
      }
      return json.embeddings;
    } catch (err) {
      if (attempt > retries) {
        this.logger.error(
          `임베딩 서비스 호출 실패 (${attempt - 1}회 재시도 후 포기): ${(err as Error).message}`,
        );
        throw new ServiceUnavailableException('embedding service unavailable');
      }
      const wait = Math.min(15_000, baseDelayMs * attempt);
      this.logger.warn(
        `임베딩 서비스 재시도 ${attempt}/${retries} (${wait}ms): ${(err as Error).message}`,
      );
      await new Promise((r) => setTimeout(r, wait));
      return this.postEmbed(texts, retries, baseDelayMs, attempt + 1);
    }
  }
}
