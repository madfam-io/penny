// Re-export from individual modules for backwards compatibility
export { JWTService, type TokenPayload, type RefreshTokenPayload } from './jwt.js';
export { PasswordService } from './password.js';
export { SessionService, type SessionData, type CreateSessionOptions, type DeviceInfo } from './session.js';
export { OAuthService, type OAuthProviderConfig, type OAuthProfile } from './oauth.js';
