import { Controller, Get, Param, Query, HttpException, HttpStatus } from '@nestjs/common';
import { IssuersService } from '../issuers/issuers.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

/**
 * /.well-known/authenx/:issuerCode/public-key
 * 
 * Public endpoint for third parties to verify credentials
 * without needing authentication. Standard .well-known pattern.
 */
@Controller('.well-known/authenx')
export class WellKnownController {
  constructor(
    private readonly issuersService: IssuersService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * GET /.well-known/authenx/:issuerCode/public-key
   * Returns all public keys for an issuer (for credential verification)
   */
  @Get(':issuerCode/public-key')
  async getPublicKey(
    @Param('issuerCode') issuerCode: string,
    @Query('version') version?: string,
  ) {
    const issuer = await this.prisma.issuer.findUnique({
      where: { issuerCode },
    });

    if (!issuer) {
      throw new HttpException(
        `Issuer "${issuerCode}" not found`,
        HttpStatus.NOT_FOUND,
      );
    }

    // If specific version requested
    if (version) {
      const keyVersion = parseInt(version, 10);
      const key = await this.prisma.issuerKey.findUnique({
        where: {
          issuerCode_keyVersion: { issuerCode, keyVersion },
        },
        select: {
          keyVersion: true,
          publicKey: true,
          active: true,
          createdAt: true,
        },
      });

      if (key) {
        return {
          issuerCode,
          keyVersion: key.keyVersion,
          publicKeyEd25519: key.publicKey,
          algorithm: 'Ed25519',
          active: key.active,
          createdAt: key.createdAt,
        };
      }

      // Fallback to legacy if version 1 requested
      if (keyVersion === 1) {
        return {
          issuerCode,
          keyVersion: 1,
          publicKeyEd25519: issuer.publicKeyEd25519,
          algorithm: 'Ed25519',
          active: true,
          createdAt: issuer.createdAt,
        };
      }

      throw new HttpException(
        `Key version ${version} not found for issuer "${issuerCode}"`,
        HttpStatus.NOT_FOUND,
      );
    }

    // Return all keys
    return this.issuersService.getPublicKeys(issuerCode);
  }

  /**
   * GET /.well-known/authenx/:issuerCode/jwks
   * Returns keys in JWK Set format (industry standard)
   */
  @Get(':issuerCode/jwks')
  async getJwks(@Param('issuerCode') issuerCode: string) {
    const keysData = await this.issuersService.getPublicKeys(issuerCode);

    // Convert to JWK Set format
    const jwks = keysData.keys.map((key) => ({
      kty: 'OKP',
      crv: 'Ed25519',
      kid: `${issuerCode}-v${key.keyVersion}`,
      x: key.publicKey, // Ed25519 public key in base64
      use: 'sig',
      alg: 'EdDSA',
    }));

    return {
      issuerCode,
      keys: jwks,
    };
  }

  /**
   * GET /.well-known/authenx/:issuerCode/did.json
   * Returns DID Document format (W3C standard for decentralized identifiers)
   */
  @Get(':issuerCode/did.json')
  async getDidDocument(@Param('issuerCode') issuerCode: string) {
    const keysData = await this.issuersService.getPublicKeys(issuerCode);

    const verificationMethods = keysData.keys.map((key) => ({
      id: `did:web:authenx.io:issuers:${issuerCode}#key-${key.keyVersion}`,
      type: 'Ed25519VerificationKey2020',
      controller: `did:web:authenx.io:issuers:${issuerCode}`,
      publicKeyMultibase: `z${key.publicKey}`, // Ed25519 public key with multibase prefix
    }));

    return {
      '@context': [
        'https://www.w3.org/ns/did/v1',
        'https://w3id.org/security/suites/ed25519-2020/v1',
      ],
      id: `did:web:authenx.io:issuers:${issuerCode}`,
      verificationMethod: verificationMethods,
      authentication: verificationMethods.map((vm) => vm.id),
      assertionMethod: verificationMethods.map((vm) => vm.id),
    };
  }
}
