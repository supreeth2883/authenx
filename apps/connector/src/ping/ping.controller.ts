import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { KeysService } from '../keys/keys.service.js';
import { AdminKeyGuard } from '../guards/admin-key.guard.js';

type PingBody = {
  nonce: string;
  ts: number;
};

@Controller()
@UseGuards(AdminKeyGuard)
export class PingController {
  constructor(private readonly keysService: KeysService) {}

  @Post('ping')
  handlePing(@Body() body: PingBody) {
    const payload = {
      ok: true,
      nonce: body.nonce,
      ts: body.ts,
    };

    // canonical JSON (stable)
    const canonical = JSON.stringify(payload);
    const signature = this.keysService.sign(canonical);

    // return signature in body (simplest + reliable)
    return { ...payload, signature };
  }
}
