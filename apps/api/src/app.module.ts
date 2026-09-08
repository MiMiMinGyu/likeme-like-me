import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import {
  envValidationSchema,
  envValidationOptions,
} from './config/env.validation';
import { TelegramModule } from './modules/telegram/telegram.module';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { KakaoModule } from './modules/kakao/kakao.module';
import { OpenaiModule } from './modules/openai/openai.module';
import { LlmModule } from './modules/llm/llm.module';
import { RelationshipModule } from './modules/relationship/relationship.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // 로컬 dev 전용. 배포 시엔 이 파일 없이 compose environment / Secrets 주입.
      envFilePath: '.env',
      validationSchema: envValidationSchema,
      validationOptions: envValidationOptions,
    }),
    PrismaModule,
    AuthModule,
    KakaoModule,
    OpenaiModule,
    LlmModule,
    RelationshipModule,
    TelegramModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
