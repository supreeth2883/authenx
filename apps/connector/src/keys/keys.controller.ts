import { Controller, Get, Post, UseGuards, Logger } from '@nestjs/common';
import { KeysService } from './keys.service.js';
import { AdminKeyGuard } from '../guards/admin-key.guard.js';

@Controller()
export class KeysController {
  private readonly logger = new Logger(KeysController.name);

  constructor(private readonly keysService: KeysService) {}

  /**
   * GET /public-key — returns the active raw Ed25519 public key (base64).
   * Used by cloud-api and verifiers to fetch the signing public key.
   */
  @Get('public-key')
  getPublicKey() {
    const issuerCode = process.env.ISSUER_CODE;
    if (!issuerCode) {
      throw new Error('ISSUER_CODE environment variable is not set');
    }
    return {
      issuerCode,
      publicKeyEd25519: this.keysService.getRawPublicKey().toString('base64'),
      keyVersion: 1,
      activeVersion: 1,
    };
  }

  /**
   * GET /public-keys — returns all known public keys (currently version 1).
   * Kept for backward compatibility with cloud-api key sync.
   */
  @Get('public-keys')
  getAllPublicKeys() {
    const issuerCode = process.env.ISSUER_CODE;
    if (!issuerCode) {
      throw new Error('ISSUER_CODE environment variable is not set');
    }
    return {
      issuerCode,
      keys: [
        {
          version: 1,
          publicKey: this.keysService.getRawPublicKey().toString('base64'),
          active: true,
        },
      ],
      activeVersion: 1,
    };
  }

  /**
   * GET /keys/debug — operational diagnostics for key management.
   * Guarded in production to prevent key metadata leaking.
   */
  @Get('keys/debug')
  @UseGuards(AdminKeyGuard)
  getDebug() {
    return {
      keySource: this.keysService.getKeySource(),
      fingerprint: this.keysService.getPublicKeyFingerprint(),
      rawPublicKeyLength: this.keysService.getRawPublicKey().length,
    };
  }

  /**
   * POST /rotate-key — disabled in ENV-based key management.
   * Key rotation should be done by updating ENV vars and redeploying.
   */
  @Post('rotate-key')
  @UseGuards(AdminKeyGuard)
  rotateKey() {
    return {
      error: 'Key rotation via API is disabled. Update SIGNING_PUBLIC_KEY_RAW and SIGNING_PRIVATE_KEY_RAW env vars and redeploy.',
      keySource: this.keysService.getKeySource(),
    };
  }
}
