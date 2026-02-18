import { Controller, Get, Post, Param, ParseIntPipe, Query, Optional, UseGuards } from '@nestjs/common';
import { KeysService } from './keys.service.js';
import { AdminKeyGuard } from '../guards/admin-key.guard.js';

@Controller()
export class KeysController {
  constructor(private readonly keysService: KeysService) {}

  @Get('public-key')
  getPublicKey(@Query('version') version?: string) {
    const issuerCode = process.env.ISSUER_CODE ?? 'CVR';
    const v = version ? parseInt(version, 10) : undefined;
    return {
      issuerCode,
      publicKeyEd25519: this.keysService.getPublicKeyBase64(v),
      keyVersion: v ?? this.keysService.getActiveVersion(),
      activeVersion: this.keysService.getActiveVersion(),
    };
  }

  @Get('public-keys')
  getAllPublicKeys() {
    const issuerCode = process.env.ISSUER_CODE ?? 'CVR';
    return {
      issuerCode,
      keys: this.keysService.getAllPublicKeys(),
      activeVersion: this.keysService.getActiveVersion(),
    };
  }

  @Post('rotate-key')
  @UseGuards(AdminKeyGuard)
  rotateKey() {
    const issuerCode = process.env.ISSUER_CODE ?? 'CVR';
    const result = this.keysService.rotateKey();
    return {
      issuerCode,
      newVersion: result.version,
      publicKey: result.publicKey,
      message: `Key rotated to version ${result.version}`,
    };
  }
}
