import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { APP_CONFIG, type AppConfig } from '../config.js';

/**
 * Envelope encryption for sensitive payroll data.
 *
 * - Each organisation has a random 256-bit data key.
 * - The data key is stored wrapped (AES-256-GCM) with the server master key.
 * - Fields are encrypted with the organisation data key using AES-256-GCM and
 *   additional authenticated data `<orgId>:<purpose>`, so ciphertext copied to
 *   another organisation or another column fails to decrypt.
 *
 * Format: `v1.<iv>.<tag>.<ciphertext>` (base64url parts).
 */
@Injectable()
export class EncryptionService {
  private readonly keyCache = new Map<string, Buffer>();

  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  newWrappedDataKey(orgId: string): string {
    return seal(this.config.masterKey, randomBytes(32), `org-key:${orgId}`);
  }

  encrypt(orgId: string, wrappedKey: string, purpose: string, plaintext: string): string {
    return seal(this.dataKey(orgId, wrappedKey), Buffer.from(plaintext, 'utf8'), `${orgId}:${purpose}`);
  }

  decrypt(orgId: string, wrappedKey: string, purpose: string, token: string): string {
    return open(this.dataKey(orgId, wrappedKey), token, `${orgId}:${purpose}`).toString('utf8');
  }

  encryptNullable(orgId: string, wrappedKey: string, purpose: string, plaintext: string | null | undefined): string | null {
    return plaintext === null || plaintext === undefined ? null : this.encrypt(orgId, wrappedKey, purpose, plaintext);
  }

  decryptNullable(orgId: string, wrappedKey: string, purpose: string, token: string | null): string | null {
    return token === null ? null : this.decrypt(orgId, wrappedKey, purpose, token);
  }

  private dataKey(orgId: string, wrappedKey: string): Buffer {
    const cached = this.keyCache.get(orgId);
    if (cached) return cached;
    const key = open(this.config.masterKey, wrappedKey, `org-key:${orgId}`);
    if (this.keyCache.size > 1000) this.keyCache.clear();
    this.keyCache.set(orgId, key);
    return key;
  }
}

function seal(key: Buffer, plaintext: Buffer, aad: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(Buffer.from(aad, 'utf8'));
  const ct = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return ['v1', iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), ct.toString('base64url')].join('.');
}

function open(key: Buffer, token: string, aad: string): Buffer {
  const [version, iv, tag, ct] = token.split('.');
  if (version !== 'v1' || !iv || !tag || ct === undefined) throw new Error('Unsupported ciphertext format');
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64url'));
  decipher.setAAD(Buffer.from(aad, 'utf8'));
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(ct, 'base64url')), decipher.final()]);
}
