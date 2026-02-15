import { Module } from '@nestjs/common';
import { VerifyController } from './verify.controller.js';
import { VerifyService } from './verify.service.js';
import { IssuersModule } from '../issuers/issuers.module.js';

@Module({
  imports: [IssuersModule],
  controllers: [VerifyController],
  providers: [VerifyService],
})
export class VerifyModule {}
