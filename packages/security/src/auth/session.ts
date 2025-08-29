import crypto from 'node:crypto';
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

export class SessionService {
  private static readonly DEFAULT_SESSION_DURATION_DAYS = 30;
  private static readonly SESSION_TOKEN_LENGTH = 32;
  private static readonly MAX_SESSIONS_PER_USER = 10;

  /**
   * Generate a secure session token
   */
  static generateSessionToken(): string {
    return crypto.randomBytes(this.SESSION_TOKEN_LENGTH).toString('hex');
  }

  /**
   * Generate a unique session ID
   */
  static generateSessionId(): string {
    return crypto.randomUUID();
  }

  /**
   * Create a new session
   */
  static createSession(options: CreateSessionOptions): Omit<SessionData, 'id'> {
    const now = new Date();
    const expiresInDays = options.expiresInDays || this.DEFAULT_SESSION_DURATION_DAYS;
    const expires = new Date(now.getTime() + (expiresInDays * 24 * 60 * 60 * 1000));

    return {
      userId: options.userId,
      tenantId: options.tenantId,
      sessionToken: this.generateSessionToken(),
      expires,
      ipAddress: options.ipAddress,
      userAgent: options.userAgent,
      deviceId: options.deviceId,
      isActive: true,
      lastAccessedAt: now,
      createdAt: now,
    };
  }

  /**
   * Check if a session is valid
   */
  static isSessionValid(session: SessionData): boolean {
    const now = new Date();
    return (
      session.isActive && 
      session.expires > now &&
      session.sessionToken && 
      session.sessionToken.length > 0
    );
  }

  /**
   * Check if a session is expired
   */
  static isSessionExpired(session: SessionData): boolean {
    return session.expires <= new Date();
  }

  /**
   * Update session last accessed time
   */
  static updateLastAccessed(session: SessionData): SessionData {
    return {
      ...session,
      lastAccessedAt: new Date(),
    };
  }

  /**
   * Extend session expiration
   */
  static extendSession(session: SessionData, additionalDays: number = 30): SessionData {
    const newExpiration = new Date(session.expires.getTime() + (additionalDays * 24 * 60 * 60 * 1000));
    
    return {
      ...session,
      expires: newExpiration,
    };
  }

  /**
   * Invalidate a session
   */
  static invalidateSession(session: SessionData): SessionData {
    return {
      ...session,
      isActive: false,
    };
  }

  /**
   * Generate device fingerprint from user agent and other factors
   */
  static generateDeviceFingerprint(userAgent?: string, ipAddress?: string): string {
    const components = [
      userAgent || 'unknown',
      ipAddress || 'unknown',
    ];
    
    return crypto
      .createHash('sha256')
      .update(components.join('|'))
      .digest('hex');
  }

  /**
   * Parse user agent to extract device information
   */
  static parseUserAgent(userAgent?: string): DeviceInfo {
    if (!userAgent) {
      return {
        deviceId: '',
        fingerprint: '',
        browser: 'Unknown',
        os: 'Unknown',
        isMobile: false,
      };
    }

    const deviceId = crypto.randomUUID();
    const fingerprint = this.generateDeviceFingerprint(userAgent);
    
    // Basic user agent parsing (in production, use a proper library)
    let browser = 'Unknown';
    let os = 'Unknown';
    let isMobile = false;

    // Detect browser
    if (userAgent.includes('Chrome')) browser = 'Chrome';
    else if (userAgent.includes('Firefox')) browser = 'Firefox';
    else if (userAgent.includes('Safari')) browser = 'Safari';
    else if (userAgent.includes('Edge')) browser = 'Edge';

    // Detect OS
    if (userAgent.includes('Windows')) os = 'Windows';
    else if (userAgent.includes('Mac')) os = 'macOS';
    else if (userAgent.includes('Linux')) os = 'Linux';
    else if (userAgent.includes('Android')) os = 'Android';
    else if (userAgent.includes('iOS')) os = 'iOS';

    // Detect mobile
    isMobile = /Mobile|Android|iPhone|iPad/.test(userAgent);

    return {
      deviceId,
      fingerprint,
      browser,
      os,
      isMobile,
    };
  }

  /**
   * Generate a secure CSRF token
   */
  static generateCSRFToken(): string {
    return crypto.randomBytes(32).toString('base64url');
  }

  /**
   * Verify CSRF token
   */
  static verifyCSRFToken(token: string, storedToken: string): boolean {
    if (!token || !storedToken) {
      return false;
    }
    
    return crypto.timingSafeEqual(
      Buffer.from(token),
      Buffer.from(storedToken)
    );
  }

  /**
   * Calculate session risk score based on various factors
   */
  static calculateSessionRiskScore(
    session: SessionData,
    currentIp?: string,
    currentUserAgent?: string
  ): {
    score: number;
    factors: string[];
  } {
    let score = 0;
    const factors: string[] = [];

    // IP address change
    if (session.ipAddress && currentIp && session.ipAddress !== currentIp) {
      score += 30;
      factors.push('IP address changed');
    }

    // User agent change
    if (session.userAgent && currentUserAgent && session.userAgent !== currentUserAgent) {
      score += 20;
      factors.push('User agent changed');
    }

    // Session age
    const sessionAge = Date.now() - session.createdAt.getTime();
    const hoursOld = sessionAge / (1000 * 60 * 60);
    
    if (hoursOld > 24 * 7) { // More than a week old
      score += 15;
      factors.push('Session is old');
    }

    // Long period of inactivity
    const inactiveTime = Date.now() - session.lastAccessedAt.getTime();
    const hoursInactive = inactiveTime / (1000 * 60 * 60);
    
    if (hoursInactive > 24) { // More than a day inactive
      score += 10;
      factors.push('Long period of inactivity');
    }

    return { score, factors };
  }

  /**
   * Should session require re-authentication based on risk score
   */
  static shouldRequireReAuth(riskScore: number): boolean {
    return riskScore >= 50; // Configurable threshold
  }
}