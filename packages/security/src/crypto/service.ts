import { CryptoService } from './index.js';

// Create a singleton instance with environment-based configuration
let cryptoServiceInstance: CryptoService | null = null;

export function getCryptoService(): CryptoService {
  if (!cryptoServiceInstance) {
    const encryptionKey = process.env.ENCRYPTION_KEY;
    if (!encryptionKey) {
      throw new Error('ENCRYPTION_KEY environment variable is required');
    }

    // Validate key length (32 bytes = 64 hex characters)
    if (encryptionKey.length !== 64) {
      throw new Error('ENCRYPTION_KEY must be 32 bytes (64 hex characters)');
    }

    const masterKey = Buffer.from(encryptionKey, 'hex');
    cryptoServiceInstance = new CryptoService(masterKey);
  }

  return cryptoServiceInstance;
}
