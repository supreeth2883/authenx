import { Module } from '@nestjs/common';
import { PingController } from './ping.controller.js';
import { KeysModule } from '../keys/keys.module.js';

@Module({
  imports: [KeysModule],
  controllers: [PingController],
})
export class PingModule {}
