import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller.js';
import { AdminIssuersController } from './admin-issuers.controller.js';
import { HealthController } from './health.controller.js';
import { IssuersModule } from '../issuers/issuers.module.js';
import { CredentialsModule } from '../credentials/credentials.module.js';

@Module({
  imports: [IssuersModule, CredentialsModule],
  controllers: [AdminController, AdminIssuersController, HealthController],
})
export class AdminModule {}
