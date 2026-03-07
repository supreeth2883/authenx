import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import * as nacl from 'tweetnacl';
import * as naclUtil from 'tweetnacl-util';
import * as crypto from 'crypto';

/**
 * Decode a base64 string and validate its exact byte length.
 * Throws immediately on invalid base64 or unexpected length.
 */
function decodeBase64Strict(
  str: string,
  expectedLen: number,
  label: string,
): Buffer {
  let buf: Buffer;
  try {
    buf = Buffer.from(str, 'base64');
  } catch {
    throw new Error(`Invalid base64 for ${label}`);
  }
  if (buf.length !== expectedLen) {
    throw new Error(
      `Invalid length for ${label}: expected ${expectedLen}, got ${buf.length}`,
    );
  }
  return buf;
}

@Injectable()
export class KeysService implements OnModuleInit {
  private readonly logger = new Logger(KeysService.name);

  private keySource = '';
  private publicKeyRaw: Uint8Array;
  private privateKeyRaw: Uint8Array;
  private publicKeyFingerprint = '';

  onModuleInit() {
    // Priority chain: ENV_RAW → ENV_DER → GENERATED
    // If ENV keys exist we NEVER fall through to generation.
    if (this.loadRawKeypair()) return;
    if (this.loadDerKeypair()) return;
    this.generateKeypair();
  }

  // ── Key Loading Methods ──────────────────────────────────────

  /**
   * 1️⃣ SIGNING_PUBLIC_KEY_RAW + SIGNING_PRIVATE_KEY_RAW
   * Raw Ed25519 bytes encoded as base64.
   *   Public key  → 32 bytes
   *   Private key → 64 bytes (or 32-byte seed, auto-expanded)
   */
  private loadRawKeypair(): boolean {
    const envPub = process.env.SIGNING_PUBLIC_KEY_RAW;
    const envPriv = process.env.SIGNING_PRIVATE_KEY_RAW;
    if (!envPub || !envPriv) return false;

    const pub = decodeBase64Strict(envPub, 32, 'SIGNING_PUBLIC_KEY_RAW');

    let priv: Buffer;
    try {
      priv = decodeBase64Strict(envPriv, 64, 'SIGNING_PRIVATE_KEY_RAW');
    } catch {
      // Accept a 32-byte seed and expand to full 64-byte secret key
      const seed = decodeBase64Strict(
        envPriv,
        32,
        'SIGNING_PRIVATE_KEY_RAW (seed)',
      );
      const kp = nacl.sign.keyPair.fromSeed(new Uint8Array(seed));
      priv = Buffer.from(kp.secretKey);
    }

    this.publicKeyRaw = new Uint8Array(pub);
    this.privateKeyRaw = new Uint8Array(priv);
    this.keySource = 'ENV_RAW';
    this.publicKeyFingerprint = this.computeFingerprint(pub);
    this.logKeyInfo();
    return true;
  }

  /**
   * 2️⃣ SIGNING_PUBLIC_KEY + SIGNING_PRIVATE_KEY (DER: SPKI + PKCS8)
   * Converts DER-encoded keys to raw Ed25519 bytes for tweetnacl.
   */
  private loadDerKeypair(): boolean {
    const envPub = process.env.SIGNING_PUBLIC_KEY;
    const envPriv = process.env.SIGNING_PRIVATE_KEY;
    if (!envPub || !envPriv) return false;

    try {
      const pubKeyObj = crypto.createPublicKey({
        key: Buffer.from(envPub, 'base64'),
        format: 'der',
        type: 'spki',
      });
      const privKeyObj = crypto.createPrivateKey({
        key: Buffer.from(envPriv, 'base64'),
        format: 'der',
        type: 'pkcs8',
      });

      const rawPub = Buffer.from(
        (pubKeyObj.export as any)({ format: 'raw' }) as Buffer,
      );
      const rawPrivSeed = Buffer.from(
        (privKeyObj.export as any)({ format: 'raw' }) as Buffer,
      );

      if (rawPub.length !== 32) {
        throw new Error(
          `DER public key decoded to ${rawPub.length} bytes (expected 32)`,
        );
      }

      // Node.js exports Ed25519 private key as 32-byte seed → expand
      let rawPriv: Buffer;
      if (rawPrivSeed.length === 32) {
        const kp = nacl.sign.keyPair.fromSeed(new Uint8Array(rawPrivSeed));
        rawPriv = Buffer.from(kp.secretKey);
      } else if (rawPrivSeed.length === 64) {
        rawPriv = rawPrivSeed;
      } else {
        throw new Error(
          `DER private key decoded to ${rawPrivSeed.length} bytes (expected 32 or 64)`,
        );
      }

      this.publicKeyRaw = new Uint8Array(rawPub);
      this.privateKeyRaw = new Uint8Array(rawPriv);
      this.keySource = 'ENV_DER';
      this.publicKeyFingerprint = this.computeFingerprint(rawPub);
      this.logKeyInfo();
      return true;
    } catch (e) {
      this.logger.error(`Failed to load DER keys: ${(e as Error).message}`);
      throw e;
    }
  }

  /**
   * 3️⃣ Generate an ephemeral keypair.
   * Only called when BOTH ENV formats are absent.
   * Logs the keys so the operator can persist them.
   */
  private generateKeypair(): void {
    const kp = nacl.sign.keyPair();
    this.publicKeyRaw = kp.publicKey;
    this.privateKeyRaw = kp.secretKey;
    this.keySource = 'GENERATED';
    this.publicKeyFingerprint = this.computeFingerprint(
      Buffer.from(this.publicKeyRaw),
    );

    const pubB64 = Buffer.from(this.publicKeyRaw).toString('base64');
    const privB64 = Buffer.from(this.privateKeyRaw).toString('base64');

    // Provide DER equivalents for environments that prefer them
    let pubDer = '';
    let privDer = '';
    try {
      pubDer = (
        (crypto.createPublicKey as any)({
          key: Buffer.from(this.publicKeyRaw),
          format: 'raw',
          type: 'spki',
        }) as crypto.KeyObject
      )
        .export({ format: 'der', type: 'spki' })
        .toString('base64');
      privDer = (
        (crypto.createPrivateKey as any)({
          key: Buffer.from(this.privateKeyRaw.slice(0, 32)),
          format: 'raw',
          type: 'pkcs8',
        }) as crypto.KeyObject
      )
        .export({ format: 'der', type: 'pkcs8' })
        .toString('base64');
    } catch {
      // DER conversion is best-effort for the log output
    }

    console.log('='.repeat(60));
    console.log('KEY SOURCE: GENERATED');
    console.log(`Public key fingerprint: ${this.publicKeyFingerprint}`);
    console.log('');
    console.log('Persist these in Render ENV to prevent key rotation:');
    console.log(`  SIGNING_PUBLIC_KEY_RAW=${pubB64}`);
    console.log(`  SIGNING_PRIVATE_KEY_RAW=${privB64}`);
    if (pubDer && privDer) {
      console.log('');
      console.log('DER equivalents (optional):');
      console.log(`  SIGNING_PUBLIC_KEY=${pubDer}`);
      console.log(`  SIGNING_PRIVATE_KEY=${privDer}`);
    }
    console.log('='.repeat(60));
  }

  // ── Helpers ──────────────────────────────────────────────────

  /** SHA-256 fingerprint — first 8 bytes (16 hex chars). */
  private computeFingerprint(rawPub: Buffer): string {
    return crypto
      .createHash('sha256')
      .update(rawPub)
      .digest('hex')
      .slice(0, 16);
  }

  private logKeyInfo(): void {
    console.log(`KEY SOURCE: ${this.keySource}`);
    console.log(`Public key fingerprint: ${this.publicKeyFingerprint}`);
  }

  // ── Accessors ────────────────────────────────────────────────

  getKeySource(): string {
    return this.keySource;
  }

  getPublicKeyFingerprint(): string {
    return this.publicKeyFingerprint;
  }

  getRawPublicKey(): Buffer {
    return Buffer.from(this.publicKeyRaw);
  }

  // ── Signing ──────────────────────────────────────────────────

  sign(message: string): { signature: string } {
    const messageBytes = naclUtil.decodeUTF8(message);
    const signature = nacl.sign.detached(messageBytes, this.privateKeyRaw);
    return { signature: naclUtil.encodeBase64(signature) };
  }
}
