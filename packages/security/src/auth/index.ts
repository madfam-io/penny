import { SignJWT, jwtVerify, type JWTPayload } from 'jose';
import type { Role, TenantId, UserId } from '@penny/shared';

export interface TokenPayload extends JWTPayload {
  sub: string; // userId
  tid: string; // tenantId
  roles: Role[];
  sessionId: string;
}

export class JWTService {
  private secret: Uint8Array;

  constructor(secretKey: string) {
    this.secret = new TextEncoder().encode(secretKey);
  }

  async generateToken(
    userId: UserId,
    tenantId: TenantId,
    roles: Role[],
    sessionId: string,
    expiresIn = '7d',
  ): Promise<string> {
    const jwt = await new SignJWT({
      tid: tenantId,
      roles,
      sessionId,
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(userId)
      .setIssuedAt()
      .setExpirationTime(expiresIn)
      .sign(this.secret);

    return jwt;
  }

  async verifyToken(token: string): Promise<TokenPayload> {
    const { payload } = await jwtVerify(token, this.secret);
    return payload as TokenPayload;
  }

  async generateRefreshToken(
    userId: UserId,
    sessionId: string,
    expiresIn = '30d',
  ): Promise<string> {
    const jwt = await new SignJWT({
      type: 'refresh',
      sessionId,
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(userId)
      .setIssuedAt()
      .setExpirationTime(expiresIn)
      .sign(this.secret);

    return jwt;
  }
}
