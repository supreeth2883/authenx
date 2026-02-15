import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import * as nacl from 'tweetnacl';
import * as naclUtil from 'tweetnacl-util';
import * as fs from 'node:fs';
import * as path from 'node:path';

export interface KeyPairData {
  publicKey: string; // base64
  secretKey: string; // base64
}

export interface VersionedKeyStore {
  activeVersion: number;
  keys: {
    [version: number]: KeyPairData;
  };
}

@Injectable()
export class KeysService implements OnModuleInit {
  private readonly logger = new Logger(KeysService.name);
  private keyStore!: VersionedKeyStore;
  private readonly dataDir = path.join(process.cwd(), '.data');
  private readonly keysPath = path.join(this.dataDir, 'keys.json');
  private readonly versionedKeysPath = path.join(this.dataDir, 'versioned-keys.json');

  onModuleInit() {
    this.loadOrMigrateKeys();
  }

  private loadOrMigrateKeys(): void {
    // Check for new versioned key format first
    if (fs.existsSync(this.versionedKeysPath)) {
      this.logger.log('Loading versioned keys from .data/versioned-keys.json');
      this.keyStore = JSON.parse(fs.readFileSync(this.versionedKeysPath, 'utf-8')) as VersionedKeyStore;
      return;
    }

    // Migrate from legacy single-key format
    if (fs.existsSync(this.keysPath)) {
      this.logger.log('Migrating legacy keys to versioned format');
      const legacy = JSON.parse(fs.readFileSync(this.keysPath, 'utf-8')) as KeyPairData;
      this.keyStore = {
        activeVersion: 1,
        keys: {
          1: legacy,
        },
      };
      this.saveKeyStore();
      return;
    }

    // Generate new keypair
    this.logger.log('Generating new Ed25519 keypair (version 1)');
    const keyPair = nacl.sign.keyPair();

    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }

    this.keyStore = {
      activeVersion: 1,
      keys: {
        1: {
          publicKey: naclUtil.encodeBase64(keyPair.publicKey),
          secretKey: naclUtil.encodeBase64(keyPair.secretKey),
        },
      },
    };
    this.saveKeyStore();
    this.logger.log('Ed25519 keypair saved to .data/versioned-keys.json');
  }

  private saveKeyStore(): void {
    fs.writeFileSync(this.versionedKeysPath, JSON.stringify(this.keyStore, null, 2));
  }

  getActiveVersion(): number {
    return this.keyStore.activeVersion;
  }

  getPublicKeyBase64(version?: number): string {
    const v = version ?? this.keyStore.activeVersion;
    const keyData = this.keyStore.keys[v];
    if (!keyData) {
      throw new Error(`Key version ${v} not found`);
    }
    return keyData.publicKey;
  }

  getAllPublicKeys(): { version: number; publicKey: string; active: boolean }[] {
    return Object.entries(this.keyStore.keys).map(([version, data]) => ({
      version: parseInt(version, 10),
      publicKey: data.publicKey,
      active: parseInt(version, 10) === this.keyStore.activeVersion,
    }));
  }

  sign(message: string, version?: number): { signature: string; keyVersion: number } {
    const v = version ?? this.keyStore.activeVersion;
    const keyData = this.keyStore.keys[v];
    if (!keyData) {
      throw new Error(`Key version ${v} not found`);
    }

    const secretKey = naclUtil.decodeBase64(keyData.secretKey);
    const messageBytes = naclUtil.decodeUTF8(message);
    const signature = nacl.sign.detached(messageBytes, secretKey);

    return {
      signature: naclUtil.encodeBase64(signature),
      keyVersion: v,
    };
  }

  rotateKey(): { version: number; publicKey: string } {
    const newVersion = this.keyStore.activeVersion + 1;
    const keyPair = nacl.sign.keyPair();

    this.keyStore.keys[newVersion] = {
      publicKey: naclUtil.encodeBase64(keyPair.publicKey),
      secretKey: naclUtil.encodeBase64(keyPair.secretKey),
    };
    this.keyStore.activeVersion = newVersion;
    this.saveKeyStore();

    this.logger.log(`Rotated to key version ${newVersion}`);

    return {
      version: newVersion,
      publicKey: this.keyStore.keys[newVersion].publicKey,
    };
  }
}
