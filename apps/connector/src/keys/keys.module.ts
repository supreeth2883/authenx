import { Module } from '@nestjs/common';
import { KeysService } from './keys.service.js';
import { KeysController } from './keys.controller.js';

@Module({
  controllers: [KeysController],
  providers: [KeysService],
  exports: [KeysService],
})
export class KeysModule {}
