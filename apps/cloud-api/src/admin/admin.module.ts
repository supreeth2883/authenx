import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller.js';
import { AdminIssuersController } from './admin-issuers.controller.js';
import { HealthController } from './health.controller.js';
import { IssuersModule } from '../issuers/issuers.module.js';

@Module({
  imports: [IssuersModule],
  controllers: [AdminController, AdminIssuersController, HealthController],
})
export class AdminModule {}
