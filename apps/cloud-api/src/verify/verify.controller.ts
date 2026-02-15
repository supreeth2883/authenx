import { Controller, Post, Body } from '@nestjs/common';
import { VerifyService } from './verify.service.js';

@Controller('verify')
export class VerifyController {
  constructor(private readonly verifyService: VerifyService) {}

  @Post('ping')
  async ping(@Body() body: { issuerCode: string }) {
    return this.verifyService.ping(body.issuerCode);
  }
}
