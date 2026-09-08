import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // CORS 설정 - 프론트엔드에서 API 접근 허용
  app.enableCors({
    origin: true, // 개발 환경: 모든 origin 허용 (프로덕션에서는 특정 도메인으로 제한)
    credentials: true, // 쿠키, 인증 헤더 허용
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // 전역 유효성 검증 파이프 설정 (DTO 검증용)
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  // 컨테이너 SIGTERM(docker stop / compose down) 시 onModuleDestroy 훅 실행
  // → PrismaService.$disconnect 등 정리 후 종료
  app.enableShutdownHooks();

  // Swagger 설정 - API 문서화를 위해 추가
  const config = new DocumentBuilder()
    .setTitle('LikeMe API')
    .setDescription('AI 답변 추천 서비스 API')
    .setVersion('1.0')
    .addTag('telegram', '텔레그램 봇 관련 API')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: 'Enter JWT token',
        in: 'header',
      },
      'access-token', // This name here is important for matching up with @ApiBearerAuth() in your controllers
    )
    .build();

  // Swagger 문서 생성 및 /api 경로에 설정
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  await app.listen(process.env.PORT ? Number(process.env.PORT) : 3000);

  // 서버 시작 확인 메시지 (디버깅 및 접근성 향상을 위해 추가)
  console.log(
    `🚀 Server running on http://localhost:${process.env.PORT || 3000}`,
  );
  console.log(
    `📚 Swagger docs available at http://localhost:${process.env.PORT || 3000}/api`,
  );
}
void bootstrap();
