import { SignJWT, jwtVerify } from 'jose';
export class JWTService {
    secret;
    issuer;
    audience;
    constructor(secretKey, issuer = 'penny-platform', audience = 'penny-users') {
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
    async generateAccessToken(userId, tenantId, roles, sessionId, expiresIn = '15m') {
        const jwt = await new SignJWT({
            tid: tenantId,
            roles,
            sessionId,
            type: 'access',
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
    async generateRefreshToken(userId, sessionId, expiresIn = '30d') {
        const jwt = await new SignJWT({
            type: 'refresh',
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
    async verifyToken(token) {
        try {
            const { payload } = await jwtVerify(token, this.secret, {
                issuer: this.issuer,
                audience: this.audience,
            });
            return payload;
        }
        catch (error) {
            throw new Error(`Token verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    /**
     * Verify specifically a refresh token
     */
    async verifyRefreshToken(token) {
        const payload = await this.verifyToken(token);
        if (payload.type !== 'refresh') {
            throw new Error('Invalid token type: expected refresh token');
        }
        return payload;
    }
    /**
     * Generate both access and refresh tokens
     */
    async generateTokenPair(userId, tenantId, roles, sessionId, accessExpiresIn = '15m', refreshExpiresIn = '30d') {
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
    extractTokenFromHeader(authHeader) {
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
    isTokenExpired(token) {
        try {
            const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
            if (!payload.exp) {
                return true;
            }
            return Date.now() >= payload.exp * 1000;
        }
        catch {
            return true;
        }
    }
    /**
     * Get token expiration time
     */
    getTokenExpiration(token) {
        try {
            const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
            if (!payload.exp) {
                return null;
            }
            return new Date(payload.exp * 1000);
        }
        catch {
            return null;
        }
    }
    /**
     * Create a token blacklist entry (for logout)
     * This would typically be stored in Redis or a cache
     */
    async blacklistToken(token) {
        // Implementation would depend on your cache/storage solution
        // For now, this is a placeholder
        console.log(`Token blacklisted: ${token.substring(0, 10)}...`);
    }
}
//# sourceMappingURL=jwt.js.map