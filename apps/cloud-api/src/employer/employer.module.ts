import { Module } from '@nestjs/common';
import { EmployerController } from './employer.controller.js';
import { CredentialsModule } from '../credentials/credentials.module.js';

@Module({
  imports: [CredentialsModule],
  controllers: [EmployerController],
})
export class EmployerModule {}
