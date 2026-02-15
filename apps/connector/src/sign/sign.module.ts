import { Module } from '@nestjs/common';
import { SignController } from './sign.controller.js';
import { KeysModule } from '../keys/keys.module.js';

@Module({
  imports: [KeysModule],
  controllers: [SignController],
})
export class SignModule {}
