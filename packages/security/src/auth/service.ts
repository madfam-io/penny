import { JWTService } from './index.js';

// Create singleton instances with environment-based configuration
let jwtServiceInstance: JWTService | null = null;
let jwtRefreshServiceInstance: JWTService | null = null;

export function getJWTService(): JWTService {
  if (!jwtServiceInstance) {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error('JWT_SECRET environment variable is required');
    }
    jwtServiceInstance = new JWTService(secret);
  }
  return jwtServiceInstance;
}

export function getJWTRefreshService(): JWTService {
  if (!jwtRefreshServiceInstance) {
    const secret = process.env.JWT_REFRESH_SECRET;
    if (!secret) {
      throw new Error('JWT_REFRESH_SECRET environment variable is required');
    }
    jwtRefreshServiceInstance = new JWTService(secret);
  }
  return jwtRefreshServiceInstance;
}

export function getJWTExpiry(): string {
  return process.env.JWT_EXPIRY || '15m';
}

export function getJWTRefreshExpiry(): string {
  return process.env.JWT_REFRESH_EXPIRY || '7d';
}