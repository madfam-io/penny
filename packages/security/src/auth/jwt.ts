import { SignJWT, jwtVerify, type JWTPayload } from 'jose';
import type { Role, TenantId, UserId } from '@penny/shared';

export interface TokenPayload extends JWTPayload {
  sub: string; // userId
  tid: string; // tenantId
  roles: Role[];
  sessionId: string;
  type?: 'access' | 'refresh';
}

export interface RefreshTokenPayload extends JWTPayload {
  sub: string; // userId
  sessionId: string;
  type: 'refresh';
}

export class JWTService {
  private secret: Uint8Array;
  private issuer: string;
  private audience: string;

  constructor(
    secretKey: string,
    issuer: string = 'penny-platform',
    audience: string = 'penny-users'
  ) {
    if (!secretKey || secretKey.length < 32) {
      throw new Error('JWT secret must be at least 32 characters long');
    }
    
    this.secret = new TextEncoder().encode(secretKey);
    this.issuer = issuer;
    this.audience = audience;
  }

  /**
   * Generate an access token
   */
  async generateAccessToken(
    userId: UserId,
    tenantId: TenantId,
    roles: Role[],
    sessionId: string,
    expiresIn = '15m',
  ): Promise<string> {
    const jwt = await new SignJWT({
      tid: tenantId,
      roles,
      sessionId,
      type: 'access' as const,
    })
      .setProtectedHeader({ 
        alg: 'HS256',
        typ: 'JWT'
      })
      .setSubject(userId)
      .setIssuer(this.issuer)
      .setAudience(this.audience)
      .setIssuedAt()
      .setExpirationTime(expiresIn)
      .sign(this.secret);

    return jwt;
  }

  /**
   * Generate a refresh token
   */
  async generateRefreshToken(
    userId: UserId,
    sessionId: string,
    expiresIn = '30d',
  ): Promise<string> {
    const jwt = await new SignJWT({
      type: 'refresh' as const,
      sessionId,
    })
      .setProtectedHeader({ 
        alg: 'HS256',
        typ: 'JWT'
      })
      .setSubject(userId)
      .setIssuer(this.issuer)
      .setAudience(this.audience)
      .setIssuedAt()
      .setExpirationTime(expiresIn)
      .sign(this.secret);

    return jwt;
  }

  /**
   * Verify and decode a JWT token
   */
  async verifyToken(token: string): Promise<TokenPayload> {
    try {
      const { payload } = await jwtVerify(token, this.secret, {
        issuer: this.issuer,
        audience: this.audience,
      });
      
      return payload as TokenPayload;
    } catch (error) {
      throw new Error(`Token verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Verify specifically a refresh token
   */
  async verifyRefreshToken(token: string): Promise<RefreshTokenPayload> {
    const payload = await this.verifyToken(token);
    
    if (payload.type !== 'refresh') {
      throw new Error('Invalid token type: expected refresh token');
    }
    
    return payload as RefreshTokenPayload;
  }

  /**
   * Generate both access and refresh tokens
   */
  async generateTokenPair(
    userId: UserId,
    tenantId: TenantId,
    roles: Role[],
    sessionId: string,
    accessExpiresIn = '15m',
    refreshExpiresIn = '30d',
  ): Promise<{
    accessToken: string;
    refreshToken: string;
  }> {
    const [accessToken, refreshToken] = await Promise.all([
      this.generateAccessToken(userId, tenantId, roles, sessionId, accessExpiresIn),
      this.generateRefreshToken(userId, sessionId, refreshExpiresIn),
    ]);

    return {
      accessToken,
      refreshToken,
    };
  }

  /**
   * Extract token from Authorization header
   */
  extractTokenFromHeader(authHeader: string | undefined): string | null {
    if (!authHeader) {
      return null;
    }

    const [scheme, token] = authHeader.split(' ');
    
    if (scheme !== 'Bearer' || !token) {
      return null;
    }

    return token;
  }

  /**
   * Check if token is expired (without verifying signature)
   */
  isTokenExpired(token: string): boolean {
    try {
      const payload = JSON.parse(
        Buffer.from(token.split('.')[1], 'base64').toString()
      );
      
      if (!payload.exp) {
        return true;
      }
      
      return Date.now() >= payload.exp * 1000;
    } catch {
      return true;
    }
  }

  /**
   * Get token expiration time
   */
  getTokenExpiration(token: string): Date | null {
    try {
      const payload = JSON.parse(
        Buffer.from(token.split('.')[1], 'base64').toString()
      );
      
      if (!payload.exp) {
        return null;
      }
      
      return new Date(payload.exp * 1000);
    } catch {
      return null;
    }
  }

  /**
   * Create a token blacklist entry (for logout)
   * This would typically be stored in Redis or a cache
   */
  async blacklistToken(token: string): Promise<void> {
    // Implementation would depend on your cache/storage solution
    // For now, this is a placeholder
    console.log(`Token blacklisted: ${token.substring(0, 10)}...`);
  }
}