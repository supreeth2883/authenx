import { Controller, Post, Body, Logger } from '@nestjs/common';
import { KeysService } from '../keys/keys.service.js';

@Controller('sign')
export class SignController {
  private readonly logger = new Logger(SignController.name);

  constructor(private readonly keysService: KeysService) {}

  @Post()
  sign(@Body() body: { payload: string }) {
    this.logger.log(`Signing payload (${body.payload.length} chars)`);
    const result = this.keysService.sign(body.payload);
    return {
      signature: result.signature,
      keyVersion: result.keyVersion,
    };
  }
}
