import { Controller, Post, Body, Logger, UseGuards } from '@nestjs/common';
import { KeysService } from '../keys/keys.service.js';
import { AdminKeyGuard } from '../guards/admin-key.guard.js';

@Controller('sign')
@UseGuards(AdminKeyGuard)
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
