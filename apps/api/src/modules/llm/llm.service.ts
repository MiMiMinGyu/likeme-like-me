import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { OpenaiService } from '../openai/openai.service';
import { EmbeddingService } from '../embedding/embedding.service';
import {
  GenerateReplyResponse,
  GenerateMultipleRepliesResponse,
  RecentContext,
  ReceiverInfo,
  SimilarContext,
  StyleProfile,
} from './interfaces/llm.interface';
import { ChatMessage } from '../openai/interfaces/openai.interface';
import { UpdateStyleProfileDto } from './dto';

@Injectable()
export class LlmService {
  private readonly logger = new Logger(LlmService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly openai: OpenaiService,
    private readonly embedding: EmbeddingService,
  ) {}

  /**
   * 최근 대화 내역 조회
   * @param userId 사용자 ID
   * @param partnerId 대화 상대 Partner ID
   * @param limit 조회할 메시지 수 (기본 20개)
   */
  async getRecentContext(
    userId: string,
    partnerId: string,
    limit = 20,
  ): Promise<RecentContext> {
    this.logger.log(
      `Fetching recent ${limit} messages for user ${userId} with partner ${partnerId}`,
    );

    // 최적화: Conversation과 메시지를 한 번의 쿼리로 조회
    const conversation = await this.prisma.conversation.findFirst({
      where: {
        user_id: userId,
        partner_id: partnerId,
      },
      include: {
        messages: {
          orderBy: {
            created_at: 'desc',
          },
          take: limit,
          select: {
            role: true,
            text: true,
            created_at: true,
          },
        },
      },
    });

    if (!conversation) {
      this.logger.warn(
        `No conversation found for user ${userId} and partner ${partnerId}`,
      );
      return { messages: [] };
    }

    // 시간 순서대로 정렬 (오래된 것부터)
    const orderedMessages = conversation.messages.reverse().map((msg) => ({
      sender: msg.role === 'user' ? 'user' : 'assistant',
      content: msg.text,
      timestamp: msg.created_at || new Date(),
    }));

    return {
      messages: orderedMessages,
    };
  }

  /**
   * 벡터 유사도 검색 (pgvector)
   * @param userId 사용자 ID
   * @param messageContent 검색할 메시지 내용
   * @param limit 조회할 개수 (기본 5개)
   * @param politeness 대화 상대와의 존댓말 수준(FORMAL/POLITE/CASUAL). 있으면 같은
   *   수준의 톤샘플을 우선 검색하고, 부족한 만큼만 전역에서 폴백한다.
   */
  async getSimilarContext(
    userId: string,
    messageContent: string,
    limit = 5,
    politeness?: string,
  ): Promise<SimilarContext> {
    this.logger.log(
      `Searching similar tone samples for user ${userId}, limit ${limit}, politeness ${politeness ?? '(any)'}`,
    );

    // 1. 메시지 임베딩 생성 (KoSimCSE 768차원, 자체 호스팅)
    const embedding = await this.embedding.embed(messageContent);
    const vectorString = `[${embedding.join(',')}]`;

    type SampleRow = { id: string; text: string; similarity: number };

    // 2. pgvector 코사인 유사도 검색 (HNSW 인덱스 활용)
    //    politeness가 있으면 같은 존댓말 수준 안에서 먼저 찾는다. 이렇게 하지 않으면
    //    "월요일 밥약속" 같은 주제 유사도만으로 검색되어, 이 상대와 무관한 다른
    //    반말 상대의 예시가 섞여 답변 톤이 흔들린다.
    let samples: SampleRow[];
    if (politeness) {
      samples = await this.prisma.$queryRaw<SampleRow[]>(Prisma.sql`
        SELECT id, text, 1 - (embedding <=> ${vectorString}::vector) as similarity
        FROM tone_samples
        WHERE user_id = ${userId}::uuid
          AND embedding IS NOT NULL
          AND politeness = ${politeness}::"PolitenessLevel"
        ORDER BY embedding <=> ${vectorString}::vector
        LIMIT ${limit}
      `);

      if (samples.length < limit) {
        const remaining = limit - samples.length;
        const excludeIds = samples.map((s) => s.id);
        const exclude =
          excludeIds.length > 0
            ? Prisma.sql`AND id::text NOT IN (${Prisma.join(excludeIds)})`
            : Prisma.empty;

        const fallback = await this.prisma.$queryRaw<SampleRow[]>(Prisma.sql`
          SELECT id, text, 1 - (embedding <=> ${vectorString}::vector) as similarity
          FROM tone_samples
          WHERE user_id = ${userId}::uuid
            AND embedding IS NOT NULL
            ${exclude}
          ORDER BY embedding <=> ${vectorString}::vector
          LIMIT ${remaining}
        `);

        this.logger.log(
          `politeness=${politeness} 버킷에서 ${samples.length}/${limit}개만 발견, 전역 폴백으로 ${fallback.length}개 보충`,
        );
        samples = [...samples, ...fallback];
      }
    } else {
      samples = await this.prisma.$queryRaw<SampleRow[]>(Prisma.sql`
        SELECT id, text, 1 - (embedding <=> ${vectorString}::vector) as similarity
        FROM tone_samples
        WHERE user_id = ${userId}::uuid
          AND embedding IS NOT NULL
        ORDER BY embedding <=> ${vectorString}::vector
        LIMIT ${limit}
      `);
    }

    this.logger.log(`Found ${samples.length} similar examples`);

    return {
      examples: samples.map(({ text, similarity }) => ({ text, similarity })),
    };
  }

  /**
   * 사용자 말투 프로필 조회
   * @param userId 사용자 ID
   */
  async getStyleProfile(userId: string): Promise<StyleProfile> {
    this.logger.log(`Fetching style profile for user ${userId}`);

    const profile = await this.prisma.styleProfile.findUnique({
      where: { user_id: userId },
    });

    if (!profile) {
      this.logger.warn(`No style profile found for user ${userId}`);
      return {
        characteristics: [],
      };
    }

    const characteristics: string[] = [];

    // StyleProfile은 honorific_rules, constraints만 있음
    // ToneSample에서 SQL 집계로 통계 계산 (최적화: 인메모리 → SQL)
    const [politenessStats, vibeStats, totalCount] = await Promise.all([
      // 가장 많이 사용된 politeness 조회
      this.prisma.$queryRaw<Array<{ politeness: string; count: bigint }>>`
        SELECT politeness, COUNT(*) as count
        FROM tone_samples
        WHERE user_id = ${userId}::uuid AND politeness IS NOT NULL
        GROUP BY politeness
        ORDER BY count DESC
        LIMIT 1
      `,
      // 가장 많이 사용된 vibe 조회
      this.prisma.$queryRaw<Array<{ vibe: string; count: bigint }>>`
        SELECT vibe, COUNT(*) as count
        FROM tone_samples
        WHERE user_id = ${userId}::uuid AND vibe IS NOT NULL
        GROUP BY vibe
        ORDER BY count DESC
        LIMIT 1
      `,
      // 전체 샘플 개수
      this.prisma.toneSample.count({ where: { user_id: userId } }),
    ]);

    const maxPoliteness = politenessStats[0]?.politeness || '';
    const maxVibe = vibeStats[0]?.vibe || '';

    if (maxPoliteness) {
      characteristics.push(`존댓말/반말: ${maxPoliteness}`);
    }
    if (maxVibe) {
      characteristics.push(`말투 분위기: ${maxVibe}`);
    }

    characteristics.push(`분석된 대화 샘플: ${totalCount}개`);

    return {
      politenessLevel: maxPoliteness || undefined,
      vibeType: maxVibe || undefined,
      characteristics,
    };
  }

  /**
   * 수신자 (대화 상대) 정보 조회
   * @param userId 사용자 ID
   * @param partnerId Partner ID
   */
  async getReceiverInfo(
    userId: string,
    partnerId: string,
  ): Promise<ReceiverInfo> {
    this.logger.log(`Fetching receiver info for partner ${partnerId}`);

    // 최적화: Partner와 Relationship을 한 번의 쿼리로 조회
    const partner = await this.prisma.partner.findUnique({
      where: { id: partnerId },
      include: {
        relationships: {
          where: {
            user_id: userId,
          },
          take: 1,
        },
      },
    });

    if (!partner) {
      throw new NotFoundException(`Partner not found: ${partnerId}`);
    }

    const relationship = partner.relationships[0];

    return {
      name: partner.name,
      // 관계 정보가 없으면 격식 있는 존댓말 카테고리 (ACQUAINTANCE_CASUAL) 사용
      category: relationship?.category || 'ACQUAINTANCE_CASUAL',
      politeness: relationship?.politeness || 'POLITE',
      vibe: relationship?.vibe || 'CALM',
      relationshipDescription: relationship
        ? `${relationship.politeness || 'CASUAL'}, ${relationship.vibe || 'CALM'}`
        : '격식 있는 존댓말', // 관계 정보 없을 때 기본 설명
    };
  }

  /**
   * politeness 값을 종결어미 지시문으로 변환.
   * 예시 텍스트에 반말이 섞여 있어도 이 지시가 우선하도록 명령형으로 작성.
   */
  private politenessInstruction(politeness?: string): string {
    switch (politeness) {
      case 'FORMAL':
        return '반드시 격식 있는 존댓말(-습니다체)로 답변할 것';
      case 'CASUAL':
        return '반드시 반말로 답변할 것';
      case 'POLITE':
      default:
        return '반드시 존댓말(-요체)로 답변할 것. 반말 종결어미(-야, -자, -어) 사용 금지';
    }
  }

  /**
   * "다음에 ~하자" 류 거절+재약속 표현의 전체 문장 예시를 politeness에 맞게 제공.
   * 이 관용구는 반말 형태(-자)가 워낙 흔해서, 어미만 예시로 주면 LLM이 앞 절은
   * 반말로 두고 끝만 존댓말로 바꾸는 경우가 있어(예: "오늘은 힘들어 다음에 해요"),
   * 문장 전체를 예시로 고정해 앞뒤 어체가 일치하도록 한다.
   */
  private declineExample(politeness?: string): string {
    switch (politeness) {
      case 'FORMAL':
        return '그건 조금 어려울 것 같습니다, 다음에 하겠습니다';
      case 'CASUAL':
        return '그건 조금 어려울 것 같아, 다음에 하자';
      case 'POLITE':
      default:
        return '그건 조금 어려울 것 같아요, 다음에 해요';
    }
  }

  /**
   * LLM 프롬프트 구성 (FastAPI 로직 포팅)
   * @param userName 사용자 이름
   * @param styleProfile 말투 프로필
   * @param recentContext 최근 대화
   * @param similarContext 유사 말투 예시
   * @param receiverInfo 수신자 정보
   * @param message 수신한 메시지
   * @param customGuidelines 사용자 정의 말투 지침 (선택)
   */
  buildPrompt(
    userName: string,
    styleProfile: StyleProfile,
    recentContext: RecentContext,
    similarContext: SimilarContext,
    receiverInfo: ReceiverInfo,
    message: string,
    customGuidelines?: string,
  ): ChatMessage[] {
    // 말투 예시 텍스트 (유사도 높은 순)
    const profileText = similarContext.examples.map((ex) => ex.text).join('\n');

    // 최근 대화 텍스트
    const recentMessagesText = recentContext.messages
      .map((msg) => `${msg.sender}: ${msg.content}`)
      .join('\n');

    // 기본 제약 조건 (사용자 정의 지침이 없을 경우)
    // 개인차가 큰 항목은 제외하고, 최소한의 일반적인 가이드만 제공
    const defaultConstraints = `
[답변 제약 조건]
- ${this.politenessInstruction(receiverInfo.politeness)}
- 제공된 말투 예시는 문장 리듬·감탄사·어휘 참고용이며, 예시의 종결어미가 위 존댓말/반말 지시와 다르면 지시를 따를 것
- 대화 상대와의 관계(${receiverInfo.category})에 맞는 격식 수준 유지
- 최근 대화 맥락을 고려하여 일관성 있는 톤 유지
`;

    // 사용자 정의 지침 또는 기본 제약 조건
    const constraints = customGuidelines
      ? `\n[🚨 CRITICAL: 사용자 정의 말투 규칙 - 반드시 준수할 것]\n${customGuidelines}\n`
      : defaultConstraints;

    // System prompt
    const systemContent = `너는 사용자 '${userName}'의 말투를 모방하는 AI야.

${constraints}

⚠️ 위 규칙은 절대적이며, 어떤 경우에도 위반해서는 안 됨. 특히 문장부호 사용 금지 규칙이 있다면 반드시 지켜야 함.

⚠️ [최근 대화 맥락]에 언급된 시점(요일·날짜 등)과 답변의 시제가 어긋나지 않게 할 것. 예를 들어 특정 요일(예: 월요일)에 대한 이야기가 진행 중이라면 "오늘"이라고 표현하지 말 것.

아래 대화록은 ${userName}의 실제 말투 예시야.
${userName}의 문장 리듬, 감탄사, 억양, 말끝, 문장 길이를 세밀하게 분석해 그대로 반영해.
답변은 자연스럽고 짧게, 최대 두 문장에서 세 문장 이내로 핵심만 말해.

[말투 예시]
${profileText}

[대화 상대 정보]
이름: ${receiverInfo.name}
관계: ${receiverInfo.category}
${receiverInfo.relationshipDescription ? `설명: ${receiverInfo.relationshipDescription}` : ''}

[최근 대화 맥락]
${recentMessagesText || '(최근 대화 없음)'}

[말투 분석 결과]
${styleProfile.characteristics.length > 0 ? styleProfile.characteristics.join('\n') : '(분석 중)'}

위 모든 조건을 반영하여 ${userName}처럼 답변해줘.`;

    const userContent = `${receiverInfo.name}: ${message}`;

    return [
      { role: 'system' as const, content: systemContent },
      { role: 'user' as const, content: userContent },
    ];
  }

  /**
   * LLM 답변 생성 (메인 메서드)
   * @param userId 사용자 ID
   * @param partnerId 대화 상대 Partner ID
   * @param message 수신한 메시지
   */
  async generateReply(
    userId: string,
    partnerId: string,
    message: string,
  ): Promise<GenerateReplyResponse> {
    this.logger.log(
      `[LLM] 📨 요청 수신 - userId: ${userId}, partnerId: ${partnerId}, message: "${message}"`,
    );

    // 1. 사용자 정보 조회
    this.logger.log(`[LLM] 1️⃣ 사용자 정보 조회 중...`);
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      this.logger.error(`[LLM] ❌ 사용자를 찾을 수 없음: ${userId}`);
      throw new NotFoundException(`User not found: ${userId}`);
    }

    const userName = user.name || 'User';
    this.logger.log(`[LLM] ✅ 사용자 찾음: ${userName} (${user.email})`);

    // 2. 컨텍스트 수집 + 사용자 정의 지침 조회
    // 대화 상대의 politeness를 먼저 알아야 그 수준에 맞는 톤샘플을 검색할 수 있어서
    // getReceiverInfo는 먼저 조회하고, 나머지만 병렬로 처리한다.
    this.logger.log(`[LLM] 2️⃣ 컨텍스트 수집 시작...`);
    const receiverInfo = await this.getReceiverInfo(userId, partnerId);

    const [recentContext, similarContext, styleProfile, userStyleProfile] =
      await Promise.all([
        this.getRecentContext(userId, partnerId, 20),
        this.getSimilarContext(userId, message, 15, receiverInfo.politeness), // 5 → 15로 증가
        this.getStyleProfile(userId),
        // 사용자 정의 말투 지침 조회 (Raw Query로 타입 오류 회피)
        this.prisma.$queryRaw<Array<{ custom_guidelines: string | null }>>`
        SELECT custom_guidelines
        FROM style_profiles
        WHERE user_id = ${userId}::uuid
        LIMIT 1
      `.then((rows) => rows[0] || null),
      ]);

    const customGuidelines = userStyleProfile?.custom_guidelines || undefined;

    this.logger.log(
      `[LLM] ✅ 컨텍스트 수집 완료 - 최근 메시지: ${recentContext.messages.length}개, 유사 예시: ${similarContext.examples.length}개, 사용자 지침: ${customGuidelines ? '있음' : '기본값'}`,
    );

    // 3. 프롬프트 구성
    this.logger.log(`[LLM] 3️⃣ LLM 프롬프트 구성 중...`);
    const messages = this.buildPrompt(
      userName,
      styleProfile,
      recentContext,
      similarContext,
      receiverInfo,
      message,
      customGuidelines,
    );
    this.logger.log(
      `[LLM] ✅ 프롬프트 구성 완료 (메시지 ${messages.length}개)`,
    );

    // 4. LLM API 호출 (말투 재현성 개선을 위해 파라미터 조정)
    this.logger.log(
      `[LLM] 4️⃣ OpenAI LLM API 호출 중... (temperature: 0.7, maxTokens: 100)`,
    );
    const completion = await this.openai.generateChatCompletion(messages, {
      temperature: 0.7, // 규칙 준수성 향상 (0.9 → 0.7)
      maxTokens: 100, // 충분한 답변 길이
    });

    const reply = completion.content;

    this.logger.log(`[LLM] ✅ LLM 답변 생성 성공: "${reply}"`);

    // 5. 응답 반환 (디버깅용 컨텍스트 포함)
    const response = {
      reply,
      context: {
        recentMessages: recentContext.messages.map((m) => m.content),
        similarExamples: similarContext.examples.map((e) => e.text),
        styleProfile: styleProfile.characteristics.join(', '),
        receiverInfo: `${receiverInfo.name} (${receiverInfo.category})`,
      },
    };

    this.logger.log(`[LLM] 🎉 응답 반환 완료`);
    return response;
  }

  /**
   * 말투 설정 저장/업데이트
   * @param userId 사용자 ID
   * @param dto 업데이트할 말투 설정
   */
  async updateStyleProfile(userId: string, dto: UpdateStyleProfileDto) {
    this.logger.log(
      `[LLM] 말투 설정 업데이트 - userId: ${userId}, guidelines: ${dto.customGuidelines ? '있음' : '없음'}`,
    );

    // Upsert: 존재하면 업데이트, 없으면 생성
    await this.prisma.$executeRaw`
      INSERT INTO style_profiles (user_id, custom_guidelines, updated_at)
      VALUES (${userId}::uuid, ${dto.customGuidelines || null}, NOW())
      ON CONFLICT (user_id)
      DO UPDATE SET
        custom_guidelines = ${dto.customGuidelines || null},
        updated_at = NOW()
    `;

    // 조회하여 반환
    const updated = await this.prisma.styleProfile.findUnique({
      where: { user_id: userId },
    });

    this.logger.log(`[LLM] ✅ 말투 설정 업데이트 완료`);
    return updated;
  }

  /**
   * 말투 설정 조회
   * @param userId 사용자 ID
   */
  async getStyleProfileSettings(userId: string) {
    this.logger.log(`[LLM] 말투 설정 조회 - userId: ${userId}`);

    const styleProfile = await this.prisma.styleProfile.findUnique({
      where: { user_id: userId },
    });

    if (!styleProfile) {
      this.logger.warn(`[LLM] ⚠️ 말투 설정 없음 - userId: ${userId}`);
      throw new NotFoundException('Style profile not found');
    }

    return styleProfile;
  }

  /**
   * 말투 설정 삭제 (기본값으로 리셋)
   * @param userId 사용자 ID
   */
  async deleteStyleProfile(userId: string) {
    this.logger.log(`[LLM] 말투 설정 삭제 - userId: ${userId}`);

    const styleProfile = await this.prisma.styleProfile.findUnique({
      where: { user_id: userId },
    });

    if (!styleProfile) {
      this.logger.warn(`[LLM] ⚠️ 삭제할 말투 설정 없음 - userId: ${userId}`);
      throw new NotFoundException('Style profile not found');
    }

    // custom_guidelines만 NULL로 업데이트
    await this.prisma.$executeRaw`
      UPDATE style_profiles
      SET custom_guidelines = NULL, updated_at = NOW()
      WHERE user_id = ${userId}::uuid
    `;

    this.logger.log(`[LLM] ✅ 말투 설정 삭제 완료 (기본값으로 리셋)`);
    return { message: 'Style profile deleted successfully' };
  }

  /**
   * 다중 답변 생성 (긍정/부정)
   * @param userId 사용자 ID
   * @param partnerId 대화 상대 Partner ID
   * @param message 수신한 메시지
   */
  async generateMultipleReplies(
    userId: string,
    partnerId: string,
    message: string,
  ): Promise<GenerateMultipleRepliesResponse> {
    this.logger.log(
      `[LLM] 📨 다중 답변 생성 요청 - userId: ${userId}, partnerId: ${partnerId}, message: "${message}"`,
    );

    // 1. 사용자 정보 조회
    this.logger.log(`[LLM] 1️⃣ 사용자 정보 조회 중...`);
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      this.logger.error(`[LLM] ❌ 사용자를 찾을 수 없음: ${userId}`);
      throw new NotFoundException(`User not found: ${userId}`);
    }

    const userName = user.name || 'User';
    this.logger.log(`[LLM] ✅ 사용자 찾음: ${userName} (${user.email})`);

    // 2. 컨텍스트 수집 + 사용자 정의 지침 조회
    // 대화 상대의 politeness를 먼저 알아야 그 수준에 맞는 톤샘플을 검색할 수 있어서
    // getReceiverInfo는 먼저 조회하고, 나머지만 병렬로 처리한다.
    this.logger.log(`[LLM] 2️⃣ 컨텍스트 수집 시작...`);
    const receiverInfo = await this.getReceiverInfo(userId, partnerId);

    const [recentContext, similarContext, styleProfile, userStyleProfile] =
      await Promise.all([
        this.getRecentContext(userId, partnerId, 20),
        this.getSimilarContext(userId, message, 15, receiverInfo.politeness),
        this.getStyleProfile(userId),
        this.prisma.$queryRaw<Array<{ custom_guidelines: string | null }>>`
        SELECT custom_guidelines
        FROM style_profiles
        WHERE user_id = ${userId}::uuid
        LIMIT 1
      `.then((rows) => rows[0] || null),
      ]);

    const customGuidelines = userStyleProfile?.custom_guidelines || undefined;

    this.logger.log(
      `[LLM] ✅ 컨텍스트 수집 완료 - 최근 메시지: ${recentContext.messages.length}개, 유사 예시: ${similarContext.examples.length}개, 사용자 지침: ${customGuidelines ? '있음' : '기본값'}`,
    );

    // DEBUG: Log actual custom_guidelines content
    if (customGuidelines) {
      this.logger.debug(
        `[LLM DEBUG] 📋 사용자 정의 규칙 내용:\n${customGuidelines}`,
      );
    } else {
      this.logger.warn(
        `[LLM DEBUG] ⚠️ custom_guidelines가 NULL입니다. 기본 제약사항을 사용합니다.`,
      );
    }

    // 3. 프롬프트 구성 (긍정/부정 답변 요청)
    this.logger.log(`[LLM] 3️⃣ LLM 프롬프트 구성 중 (긍정/부정 답변)...`);
    const messages = this.buildMultipleRepliesPrompt(
      userName,
      styleProfile,
      recentContext,
      similarContext,
      receiverInfo,
      message,
      customGuidelines,
    );

    // DEBUG: Log the complete prompt sent to LLM
    this.logger.debug(
      `[LLM DEBUG] 📤 LLM로 전송되는 완전한 프롬프트:\n${JSON.stringify(messages, null, 2)}`,
    );

    this.logger.log(
      `[LLM] ✅ 프롬프트 구성 완료 (메시지 ${messages.length}개)`,
    );

    // 4. LLM API 호출
    this.logger.log(
      `[LLM] 4️⃣ OpenAI LLM API 호출 중... (temperature: 0.7, maxTokens: 150)`,
    );
    const completion = await this.openai.generateChatCompletion(messages, {
      temperature: 0.7,
      maxTokens: 150, // 2개 답변 생성을 위해 토큰 증가
    });

    const reply = completion.content;
    this.logger.log(`[LLM] ✅ LLM 답변 생성 성공: "${reply}"`);

    // DEBUG: Log raw LLM response
    this.logger.debug(`[LLM DEBUG] 📥 LLM 원본 응답:\n${reply}`);

    // 5. 응답 파싱 (YES:/NO: 형식)
    const { positiveReply, negativeReply } = this.parseMultipleReplies(reply);

    this.logger.log(
      `[LLM] ✅ 답변 파싱 완료 - 긍정: "${positiveReply}", 부정: "${negativeReply}"`,
    );

    // 6. 응답 반환
    const response: GenerateMultipleRepliesResponse = {
      positiveReply,
      negativeReply,
      context: {
        recentMessages: recentContext.messages.map((m) => m.content),
        similarExamples: similarContext.examples.map((e) => e.text),
        styleProfile: styleProfile.characteristics.join(', '),
        receiverInfo: `${receiverInfo.name} (${receiverInfo.category})`,
      },
    };

    this.logger.log(`[LLM] 🎉 다중 답변 반환 완료`);
    return response;
  }

  /**
   * 긍정/부정 답변 생성 프롬프트 구성
   */
  private buildMultipleRepliesPrompt(
    userName: string,
    styleProfile: StyleProfile,
    recentContext: RecentContext,
    similarContext: SimilarContext,
    receiverInfo: ReceiverInfo,
    message: string,
    customGuidelines?: string,
  ): ChatMessage[] {
    // 말투 예시 텍스트 (유사도 높은 순)
    const profileText = similarContext.examples.map((ex) => ex.text).join('\n');

    // 최근 대화 텍스트
    const recentMessagesText = recentContext.messages
      .map((msg) => `${msg.sender}: ${msg.content}`)
      .join('\n');

    // 기본 제약 조건
    const defaultConstraints = `
[답변 제약 조건]
- ${this.politenessInstruction(receiverInfo.politeness)}
- 제공된 말투 예시는 문장 리듬·감탄사·어휘 참고용이며, 예시의 종결어미가 위 존댓말/반말 지시와 다르면 지시를 따를 것
- 대화 상대와의 관계(${receiverInfo.category})에 맞는 격식 수준 유지
- 최근 대화 맥락을 고려하여 일관성 있는 톤 유지
`;

    // 사용자 정의 지침 또는 기본 제약 조건
    const constraints = customGuidelines
      ? `\n[🚨 CRITICAL: 사용자 정의 말투 규칙 - 반드시 준수할 것]\n${customGuidelines}\n`
      : defaultConstraints;

    // System prompt (긍정/부정 답변 생성 요청)
    const systemContent = `너는 사용자 '${userName}'의 말투를 모방하는 AI야.

${constraints}

⚠️ 위 규칙은 절대적이며, 어떤 경우에도 위반해서는 안 됨. 특히 문장부호 사용 금지 규칙이 있다면 반드시 지켜야 함.

⚠️ [최근 대화 맥락]에 언급된 시점(요일·날짜 등)과 답변의 시제가 어긋나지 않게 할 것. 예를 들어 특정 요일(예: 월요일)에 대한 이야기가 진행 중이라면 "오늘"이라고 표현하지 말 것.

아래 대화록은 ${userName}의 실제 말투 예시야.
${userName}의 문장 리듬, 감탄사, 억양, 말끝, 문장 길이를 세밀하게 분석해 그대로 반영해.

[말투 예시]
${profileText}

[대화 상대 정보]
이름: ${receiverInfo.name}
관계: ${receiverInfo.category}
${receiverInfo.relationshipDescription ? `설명: ${receiverInfo.relationshipDescription}` : ''}

[최근 대화 맥락]
${recentMessagesText || '(최근 대화 없음)'}

[말투 분석 결과]
${styleProfile.characteristics.length > 0 ? styleProfile.characteristics.join('\n') : '(분석 중)'}

**중요: 아래 메시지에 대해 2가지 답변을 생성해줘:**
1. **긍정적인 답변 (YES)**: 동의하거나 수락하는 긍정적인 반응
2. **부정적인 답변 (NO)**: 거절하거나 불가능하다는 부정적인 반응
   - ${this.politenessInstruction(receiverInfo.politeness)}는 NO 답변 문장 전체(거절 이유 + 재약속 제안)에 동일하게 적용됨. 앞 절만 반말로 쓰고 끝만 존댓말로 바꾸는 식으로 섞지 말 것
   - 형식 예시(내용은 참고하지 말고 어체만 참고): "${this.declineExample(receiverInfo.politeness)}"

각 답변은 ${userName}의 말투를 완벽히 모방하며, 최대 2-3문장 이내로 자연스럽고 짧게 작성해.

**응답 형식 (반드시 준수):**
YES: [긍정 답변]
NO: [부정 답변]`;

    const userContent = `${receiverInfo.name}: ${message}`;

    return [
      { role: 'system' as const, content: systemContent },
      { role: 'user' as const, content: userContent },
    ];
  }

  /**
   * LLM 응답에서 긍정/부정 답변 파싱
   */
  private parseMultipleReplies(llmResponse: string): {
    positiveReply: string;
    negativeReply: string;
  } {
    const lines = llmResponse.split('\n');
    // YES: 로 시작하는 라인 찾기
    const positiveLine = lines.find(
      (line) =>
        line.trim().startsWith('YES:') || line.trim().startsWith('긍정:'),
    );
    // NO: 로 시작하는 라인 찾기
    const negativeLine = lines.find(
      (line) =>
        line.trim().startsWith('NO:') || line.trim().startsWith('부정:'),
    );

    let positiveReply =
      positiveLine?.replace(/^(YES:|긍정:)/i, '').trim() || '알겠습니다!';
    let negativeReply =
      negativeLine?.replace(/^(NO:|부정:)/i, '').trim() ||
      '죄송하지만 어렵습니다.';

    // 파싱 실패 시 폴백: 전체 응답을 줄바꿈으로 분리
    if (!positiveLine || !negativeLine) {
      this.logger.warn(`[LLM] ⚠️ 파싱 실패, 폴백 사용. 원본: "${llmResponse}"`);
      const fallbackLines = llmResponse.split('\n').filter((l) => l.trim());
      positiveReply = fallbackLines[0]?.trim() || '알겠습니다!';
      negativeReply = fallbackLines[1]?.trim() || '죄송하지만 어렵습니다.';
    }

    return { positiveReply, negativeReply };
  }
}
