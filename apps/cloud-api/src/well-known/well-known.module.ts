import { Module } from '@nestjs/common';
import { WellKnownController } from './well-known.controller.js';
import { IssuersModule } from '../issuers/issuers.module.js';

@Module({
  imports: [IssuersModule],
  controllers: [WellKnownController],
})
export class WellKnownModule {}
