import { type JWTPayload } from 'jose';
import type { Role, TenantId, UserId } from '@penny/shared';
export interface TokenPayload extends JWTPayload {
    sub: string;
    tid: string;
    roles: Role[];
    sessionId: string;
    type?: 'access' | 'refresh';
}
export interface RefreshTokenPayload extends JWTPayload {
    sub: string;
    sessionId: string;
    type: 'refresh';
}
export declare class JWTService {
    private secret;
    private issuer;
    private audience;
    constructor(secretKey: string, issuer?: string, audience?: string);
    /**
     * Generate an access token
     */
    generateAccessToken(userId: UserId, tenantId: TenantId, roles: Role[], sessionId: string, expiresIn?: string): Promise<string>;
    /**
     * Generate a refresh token
     */
    generateRefreshToken(userId: UserId, sessionId: string, expiresIn?: string): Promise<string>;
    /**
     * Verify and decode a JWT token
     */
    verifyToken(token: string): Promise<TokenPayload>;
    /**
     * Verify specifically a refresh token
     */
    verifyRefreshToken(token: string): Promise<RefreshTokenPayload>;
    /**
     * Generate both access and refresh tokens
     */
    generateTokenPair(userId: UserId, tenantId: TenantId, roles: Role[], sessionId: string, accessExpiresIn?: string, refreshExpiresIn?: string): Promise<{
        accessToken: string;
        refreshToken: string;
    }>;
    /**
     * Extract token from Authorization header
     */
    extractTokenFromHeader(authHeader: string | undefined): string | null;
    /**
     * Check if token is expired (without verifying signature)
     */
    isTokenExpired(token: string): boolean;
    /**
     * Get token expiration time
     */
    getTokenExpiration(token: string): Date | null;
    /**
     * Create a token blacklist entry (for logout)
     * This would typically be stored in Redis or a cache
     */
    blacklistToken(token: string): Promise<void>;
}
//# sourceMappingURL=jwt.d.ts.map