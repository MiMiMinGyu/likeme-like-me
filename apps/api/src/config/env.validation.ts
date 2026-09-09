import * as Joi from 'joi';

/**
 * 부팅 시 환경변수 검증 스키마.
 *
 * ConfigModule.forRoot({ validationSchema }) 에 연결되어, 아래 규칙을 어기면
 * Nest 가 애플리케이션을 시작하지 않고 즉시 종료한다.
 * (기존엔 `configService.get('JWT_SECRET') || 'default-secret'` 처럼 폴백으로
 *  잘못된 값을 안고 부팅됐다 — 검증으로 그 클래스의 버그를 원천 차단.)
 *
 * - required()      : 없으면 부팅 실패
 * - default(...)    : 없으면 이 값으로 주입 (process.env 에도 반영됨)
 * - allowUnknown    : 스키마에 없는 키도 통과 (POSTGRES_PASSWORD 등 compose 전용)
 */
export const envValidationSchema = Joi.object({
  // ── 애플리케이션 ──────────────────────────────────────────────
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  PORT: Joi.number().port().default(3000),

  // ── 데이터베이스 ──────────────────────────────────────────────
  DATABASE_URL: Joi.string()
    .uri({ scheme: ['postgres', 'postgresql'] })
    .required(),

  // ── JWT 인증 ─────────────────────────────────────────────────
  // HMAC 서명 키. 짧으면 무차별 위조에 취약하므로 최소 길이를 강제한다.
  JWT_SECRET: Joi.string().min(32).required(),
  JWT_ACCESS_EXPIRES_IN: Joi.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: Joi.string().default('30d'),

  // ── 외부 연동 ────────────────────────────────────────────────
  // GPT 답변 생성에 필수. (임베딩은 EMBEDDING_URL 의 자체 서비스 사용)
  OPENAI_API_KEY: Joi.string().required(),
  // GPT 채팅 모델명. 코드에 문자열로 박지 않고 여기서 기본값을 준다 —
  // OpenAI 가 모델을 retire 하면 배포 환경에서 이 값만 교체해 대응.
  OPENAI_MODEL: Joi.string().default('gpt-4o-mini'),
  // KoSimCSE 임베딩 서비스. 로컬 기본값 제공, compose 에선 서비스명으로 주입.
  EMBEDDING_URL: Joi.string().uri().default('http://localhost:8000'),

  // 텔레그램 봇은 선택 — 토큰이 없으면 봇만 비활성화되고 앱은 정상 부팅된다.
  // 빈 문자열("")도 "없음"으로 취급한다: docker-compose 가 미설정 변수를
  // TELEGRAM_BOT_TOKEN= 처럼 빈 값으로 주입하는 경우가 흔해서, allow('') 없으면
  // Joi 가 "is not allowed to be empty" 로 부팅을 막는다.
  TELEGRAM_BOT_TOKEN: Joi.string().allow('').optional(),
  // 봇을 켤 경우(토큰이 비어있지 않을 때) 수신 메시지를 귀속시킬 앱 사용자 UUID.
  DEFAULT_USER_ID: Joi.string()
    .allow('')
    .when('TELEGRAM_BOT_TOKEN', {
      is: Joi.string().min(1).required(),
      then: Joi.string().guid({ version: 'uuidv4' }).required(),
      otherwise: Joi.string().guid({ version: 'uuidv4' }).allow('').optional(),
    }),
});

export const envValidationOptions = {
  // 스키마에 없는 키 허용 (POSTGRES_PASSWORD 는 docker-compose 가 참조, 앱은 미사용)
  allowUnknown: true,
  // 한 번에 모든 위반을 보여준다 (첫 에러에서 멈추지 않음)
  abortEarly: false,
};
