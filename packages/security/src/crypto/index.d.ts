import type { TenantId } from '@penny/shared';
export interface EncryptionConfig {
    algorithm: string;
    keyLength: number;
    ivLength: number;
    saltLength: number;
    tagLength: number;
}
export declare class CryptoService {
    private masterKey;
    private config;
    constructor(masterKey: Buffer, config?: EncryptionConfig);
    hashPassword(password: string): Promise<string>;
    verifyPassword(hash: string, password: string): Promise<boolean>;
    encrypt(plaintext: string, tenantId: TenantId): Promise<string>;
    decrypt(encryptedData: string, tenantId: TenantId): Promise<string>;
    generateApiKey(): string;
    generateSecretKey(): string;
    generateToken(length?: number): string;
    private deriveKey;
}
//# sourceMappingURL=index.d.ts.map