import * as argon2 from 'argon2';
import { randomBytes, createHash, createCipheriv, createDecipheriv } from 'crypto';
import type { TenantId } from '@penny/shared';

export interface EncryptionConfig {
  algorithm: string;
  keyLength: number;
  ivLength: number;
  saltLength: number;
  tagLength: number;
}

const DEFAULT_ENCRYPTION_CONFIG: EncryptionConfig = {
  algorithm: 'aes-256-gcm',
  keyLength: 32,
  ivLength: 16,
  saltLength: 32,
  tagLength: 16,
};

export class CryptoService {
  constructor(
    private masterKey: Buffer,
    private config: EncryptionConfig = DEFAULT_ENCRYPTION_CONFIG,
  ) {}

  async hashPassword(password: string): Promise<string> {
    return argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4,
    });
  }

  async verifyPassword(hash: string, password: string): Promise<boolean> {
    return argon2.verify(hash, password);
  }

  async encrypt(plaintext: string, tenantId: TenantId): Promise<string> {
    const salt = randomBytes(this.config.saltLength);
    const key = this.deriveKey(tenantId, salt);
    const iv = randomBytes(this.config.ivLength);
    
    const cipher = createCipheriv(this.config.algorithm, key, iv);
    const encrypted = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);
    
    const tag = cipher.getAuthTag();
    const combined = Buffer.concat([salt, iv, tag, encrypted]);
    
    return combined.toString('base64url');
  }

  async decrypt(encryptedData: string, tenantId: TenantId): Promise<string> {
    const combined = Buffer.from(encryptedData, 'base64url');
    
    const salt = combined.subarray(0, this.config.saltLength);
    const iv = combined.subarray(this.config.saltLength, this.config.saltLength + this.config.ivLength);
    const tag = combined.subarray(
      this.config.saltLength + this.config.ivLength,
      this.config.saltLength + this.config.ivLength + this.config.tagLength,
    );
    const encrypted = combined.subarray(this.config.saltLength + this.config.ivLength + this.config.tagLength);
    
    const key = this.deriveKey(tenantId, salt);
    const decipher = createDecipheriv(this.config.algorithm, key, iv);
    decipher.setAuthTag(tag);
    
    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]);
    
    return decrypted.toString('utf8');
  }

  generateApiKey(): string {
    return `pk_${randomBytes(32).toString('base64url')}`;
  }

  generateSecretKey(): string {
    return `sk_${randomBytes(32).toString('base64url')}`;
  }

  generateToken(length = 32): string {
    return randomBytes(length).toString('base64url');
  }

  private deriveKey(tenantId: TenantId, salt: Buffer): Buffer {
    const context = Buffer.from(`penny-tenant-${tenantId}`);
    const info = Buffer.concat([context, salt]);
    
    return createHash('sha256')
      .update(Buffer.concat([this.masterKey, info]))
      .digest()
      .subarray(0, this.config.keyLength);
  }
}