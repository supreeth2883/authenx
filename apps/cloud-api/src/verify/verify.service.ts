import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { IssuersService } from '../issuers/issuers.service.js';
import * as nacl from 'tweetnacl';
import * as naclUtil from 'tweetnacl-util';
import * as crypto from 'node:crypto';

@Injectable()
export class VerifyService {
  private readonly logger = new Logger(VerifyService.name);

  constructor(private readonly issuersService: IssuersService) {}

  async ping(issuerCode: string) {
    // 1. Look up issuer
    const issuer = await this.issuersService.findByCode(issuerCode);
    if (!issuer) {
      throw new HttpException(
        `Issuer "${issuerCode}" not found`,
        HttpStatus.NOT_FOUND,
      );
    }

    // 2. Build nonce + timestamp
    const nonce = crypto.randomBytes(16).toString('hex');
    const ts = Date.now();

    // 3. Call connector /ping with nonce + ts
    const pingUrl = `${issuer.connectorBaseUrl}/ping`;
    this.logger.log(`Sending ping to ${pingUrl} with nonce=${nonce}`);

    let response: Response;
    try {
      response = await fetch(pingUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nonce, ts }),
      });
    } catch (err) {
      throw new HttpException(
        `Connector unreachable at ${pingUrl}: ${(err as Error).message}`,
        HttpStatus.BAD_GATEWAY,
      );
    }

    if (!response.ok) {
      throw new HttpException(
        `Connector returned HTTP ${response.status}`,
        HttpStatus.BAD_GATEWAY,
      );
    }

    // 4. Parse body (signature is now in the response body)
    const body = (await response.json()) as {
      ok: boolean;
      nonce: string;
      ts: number;
      signature: string;
    };

    const signature = body.signature;
    if (!signature) {
      throw new HttpException(
        'Connector did not return signature in response',
        HttpStatus.BAD_GATEWAY,
      );
    }

    // 6. Validate nonce
    if (body.nonce !== nonce) {
      throw new HttpException(
        `Nonce mismatch: expected "${nonce}", got "${body.nonce}"`,
        HttpStatus.UNAUTHORIZED,
      );
    }

    // 7. Validate timestamp (reject if older than 30s)
    const age = Date.now() - body.ts;
    if (age > 30_000) {
      throw new HttpException(
        `Timestamp too old: ${age}ms (max 30000ms)`,
        HttpStatus.UNAUTHORIZED,
      );
    }

    // 8. Verify Ed25519 signature (against payload WITHOUT the signature field)
    const { signature: _sig, ...payloadWithoutSig } = body;
    const canonical = JSON.stringify(payloadWithoutSig);
    const messageBytes = naclUtil.decodeUTF8(canonical);
    const signatureBytes = naclUtil.decodeBase64(signature);
    const publicKeyBytes = naclUtil.decodeBase64(issuer.publicKeyEd25519);

    const valid = nacl.sign.detached.verify(
      messageBytes,
      signatureBytes,
      publicKeyBytes,
    );

    if (!valid) {
      this.logger.warn(`Signature verification FAILED for issuer ${issuerCode}`);
      throw new HttpException(
        'Signature verification failed',
        HttpStatus.UNAUTHORIZED,
      );
    }

    this.logger.log(`Signature verified ✅ for issuer ${issuerCode}`);

    return {
      ok: true,
      issuerCode,
      signatureValid: true,
      nonce,
      latencyMs: Date.now() - ts,
    };
  }
}
