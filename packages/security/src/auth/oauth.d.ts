import type { OAuthConfig } from 'next-auth/providers';
export interface OAuthProviderConfig {
    clientId: string;
    clientSecret: string;
    issuer?: string;
    scope?: string;
    allowDangerousEmailAccountLinking?: boolean;
}
export interface OAuthProfile {
    id: string;
    email: string;
    name?: string;
    image?: string;
    email_verified?: boolean;
    provider: string;
}
export declare class OAuthService {
    /**
     * Create Google OAuth configuration
     */
    static createGoogleConfig(config: OAuthProviderConfig): OAuthConfig<any>;
    /**
     * Create GitHub OAuth configuration
     */
    static createGitHubConfig(config: OAuthProviderConfig): OAuthConfig<any>;
    /**
     * Create Microsoft/Azure AD OAuth configuration
     */
    static createMicrosoftConfig(config: OAuthProviderConfig): OAuthConfig<any>;
    /**
     * Create Discord OAuth configuration
     */
    static createDiscordConfig(config: OAuthProviderConfig): OAuthConfig<any>;
    /**
     * Validate OAuth profile data
     */
    static validateProfile(profile: OAuthProfile): {
        isValid: boolean;
        errors: string[];
    };
    /**
     * Check if email format is valid
     */
    private static isValidEmail;
    /**
     * Normalize profile data across providers
     */
    static normalizeProfile(profile: OAuthProfile): OAuthProfile;
    /**
     * Check if provider is supported
     */
    static isSupportedProvider(provider: string): boolean;
    /**
     * Get provider display name
     */
    static getProviderDisplayName(provider: string): string;
    /**
     * Get provider icon/brand color
     */
    static getProviderBranding(provider: string): {
        color: string;
        iconName: string;
    };
}
//# sourceMappingURL=oauth.d.ts.map