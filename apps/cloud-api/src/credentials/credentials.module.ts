import { Module } from '@nestjs/common';
import { CredentialsController } from './credentials.controller.js';
import { CollegeCredentialsController } from './college-credentials.controller.js';
import { CredentialsService } from './credentials.service.js';
import { IssuersModule } from '../issuers/issuers.module.js';

@Module({
  imports: [IssuersModule],
  controllers: [CredentialsController, CollegeCredentialsController],
  providers: [CredentialsService],
  exports: [CredentialsService],
})
export class CredentialsModule {}
