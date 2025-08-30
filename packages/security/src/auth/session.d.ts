import type { UserId, TenantId } from '@penny/shared';
export interface SessionData {
    id: string;
    userId: UserId;
    tenantId: TenantId;
    sessionToken: string;
    expires: Date;
    ipAddress?: string;
    userAgent?: string;
    deviceId?: string;
    isActive: boolean;
    lastAccessedAt: Date;
    createdAt: Date;
}
export interface CreateSessionOptions {
    userId: UserId;
    tenantId: TenantId;
    ipAddress?: string;
    userAgent?: string;
    deviceId?: string;
    expiresInDays?: number;
}
export interface DeviceInfo {
    deviceId: string;
    fingerprint: string;
    browser: string;
    os: string;
    isMobile: boolean;
}
export declare class SessionService {
    private static readonly DEFAULT_SESSION_DURATION_DAYS;
    private static readonly SESSION_TOKEN_LENGTH;
    private static readonly MAX_SESSIONS_PER_USER;
    /**
     * Generate a secure session token
     */
    static generateSessionToken(): string;
    /**
     * Generate a unique session ID
     */
    static generateSessionId(): string;
    /**
     * Create a new session
     */
    static createSession(options: CreateSessionOptions): Omit<SessionData, 'id'>;
    /**
     * Check if a session is valid
     */
    static isSessionValid(session: SessionData): boolean;
    /**
     * Check if a session is expired
     */
    static isSessionExpired(session: SessionData): boolean;
    /**
     * Update session last accessed time
     */
    static updateLastAccessed(session: SessionData): SessionData;
    /**
     * Extend session expiration
     */
    static extendSession(session: SessionData, additionalDays?: number): SessionData;
    /**
     * Invalidate a session
     */
    static invalidateSession(session: SessionData): SessionData;
    /**
     * Generate device fingerprint from user agent and other factors
     */
    static generateDeviceFingerprint(userAgent?: string, ipAddress?: string): string;
    /**
     * Parse user agent to extract device information
     */
    static parseUserAgent(userAgent?: string): DeviceInfo;
    /**
     * Generate a secure CSRF token
     */
    static generateCSRFToken(): string;
    /**
     * Verify CSRF token
     */
    static verifyCSRFToken(token: string, storedToken: string): boolean;
    /**
     * Calculate session risk score based on various factors
     */
    static calculateSessionRiskScore(session: SessionData, currentIp?: string, currentUserAgent?: string): {
        score: number;
        factors: string[];
    };
    /**
     * Should session require re-authentication based on risk score
     */
    static shouldRequireReAuth(riskScore: number): boolean;
}
//# sourceMappingURL=session.d.ts.map