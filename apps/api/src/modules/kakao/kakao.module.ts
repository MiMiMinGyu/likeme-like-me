import { Module } from '@nestjs/common';
import { KakaoController } from './kakao.controller';
import { KakaoService } from './kakao.service';
import { KakaoTxtParser } from './parsers/kakao-txt.parser';
import { PrismaModule } from '../../prisma/prisma.module';
import { EmbeddingModule } from '../embedding/embedding.module';

@Module({
  imports: [PrismaModule, EmbeddingModule],
  controllers: [KakaoController],
  providers: [KakaoService, KakaoTxtParser],
  exports: [KakaoService],
})
export class KakaoModule {}
