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

export class OAuthService {
  /**
   * Create Google OAuth configuration
   */
  static createGoogleConfig(config: OAuthProviderConfig): OAuthConfig<any> {
    return {
      id: 'google',
      name: 'Google',
      type: 'oauth',
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      authorization: {
        params: {
          scope: config.scope || 'openid email profile',
          prompt: 'consent',
          access_type: 'offline',
          response_type: 'code',
        },
      },
      token: 'https://oauth2.googleapis.com/token',
      userinfo: 'https://www.googleapis.com/oauth2/v2/userinfo',
      profile(profile: any): OAuthProfile {
        return {
          id: profile.id,
          email: profile.email,
          name: profile.name,
          image: profile.picture,
          email_verified: profile.verified_email,
          provider: 'google',
        };
      },
      allowDangerousEmailAccountLinking: config.allowDangerousEmailAccountLinking || false,
    };
  }

  /**
   * Create GitHub OAuth configuration
   */
  static createGitHubConfig(config: OAuthProviderConfig): OAuthConfig<any> {
    return {
      id: 'github',
      name: 'GitHub',
      type: 'oauth',
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      authorization: {
        url: 'https://github.com/login/oauth/authorize',
        params: {
          scope: config.scope || 'read:user user:email',
        },
      },
      token: 'https://github.com/login/oauth/access_token',
      userinfo: {
        url: 'https://api.github.com/user',
        async request({ tokens, provider }) {
          // Get user profile
          const profile = await fetch('https://api.github.com/user', {
            headers: {
              Authorization: `Bearer ${tokens.access_token}`,
              'User-Agent': 'penny-platform',
            },
          }).then(res => res.json());

          // Get user emails if email is not public
          if (!profile.email) {
            const emails = await fetch('https://api.github.com/user/emails', {
              headers: {
                Authorization: `Bearer ${tokens.access_token}`,
                'User-Agent': 'penny-platform',
              },
            }).then(res => res.json());

            const primaryEmail = emails.find((email: any) => email.primary);
            if (primaryEmail) {
              profile.email = primaryEmail.email;
              profile.email_verified = primaryEmail.verified;
            }
          }

          return profile;
        },
      },
      profile(profile: any): OAuthProfile {
        return {
          id: profile.id.toString(),
          email: profile.email,
          name: profile.name || profile.login,
          image: profile.avatar_url,
          email_verified: profile.email_verified || false,
          provider: 'github',
        };
      },
      allowDangerousEmailAccountLinking: config.allowDangerousEmailAccountLinking || false,
    };
  }

  /**
   * Create Microsoft/Azure AD OAuth configuration
   */
  static createMicrosoftConfig(config: OAuthProviderConfig): OAuthConfig<any> {
    const tenantId = config.issuer || 'common';
    
    return {
      id: 'microsoft',
      name: 'Microsoft',
      type: 'oauth',
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      authorization: {
        url: `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize`,
        params: {
          scope: config.scope || 'openid email profile',
          response_type: 'code',
          response_mode: 'query',
        },
      },
      token: `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
      userinfo: `https://graph.microsoft.com/oidc/userinfo`,
      profile(profile: any): OAuthProfile {
        return {
          id: profile.sub,
          email: profile.email,
          name: profile.name,
          image: profile.picture,
          email_verified: profile.email_verified || false,
          provider: 'microsoft',
        };
      },
      allowDangerousEmailAccountLinking: config.allowDangerousEmailAccountLinking || false,
    };
  }

  /**
   * Create Discord OAuth configuration
   */
  static createDiscordConfig(config: OAuthProviderConfig): OAuthConfig<any> {
    return {
      id: 'discord',
      name: 'Discord',
      type: 'oauth',
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      authorization: {
        url: 'https://discord.com/api/oauth2/authorize',
        params: {
          scope: config.scope || 'identify email',
        },
      },
      token: 'https://discord.com/api/oauth2/token',
      userinfo: 'https://discord.com/api/users/@me',
      profile(profile: any): OAuthProfile {
        return {
          id: profile.id,
          email: profile.email,
          name: profile.username,
          image: profile.avatar 
            ? `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.png`
            : null,
          email_verified: profile.verified || false,
          provider: 'discord',
        };
      },
      allowDangerousEmailAccountLinking: config.allowDangerousEmailAccountLinking || false,
    };
  }

  /**
   * Validate OAuth profile data
   */
  static validateProfile(profile: OAuthProfile): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (!profile.id) {
      errors.push('Profile ID is required');
    }

    if (!profile.email) {
      errors.push('Email is required');
    } else if (!this.isValidEmail(profile.email)) {
      errors.push('Invalid email format');
    }

    if (!profile.provider) {
      errors.push('Provider is required');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Check if email format is valid
   */
  private static isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Normalize profile data across providers
   */
  static normalizeProfile(profile: OAuthProfile): OAuthProfile {
    return {
      ...profile,
      email: profile.email?.toLowerCase()?.trim(),
      name: profile.name?.trim() || profile.email?.split('@')[0],
      image: profile.image || null,
      email_verified: Boolean(profile.email_verified),
    };
  }

  /**
   * Check if provider is supported
   */
  static isSupportedProvider(provider: string): boolean {
    const supportedProviders = ['google', 'github', 'microsoft', 'discord'];
    return supportedProviders.includes(provider.toLowerCase());
  }

  /**
   * Get provider display name
   */
  static getProviderDisplayName(provider: string): string {
    const displayNames: Record<string, string> = {
      google: 'Google',
      github: 'GitHub',
      microsoft: 'Microsoft',
      discord: 'Discord',
    };

    return displayNames[provider.toLowerCase()] || provider;
  }

  /**
   * Get provider icon/brand color
   */
  static getProviderBranding(provider: string): {
    color: string;
    iconName: string;
  } {
    const branding: Record<string, { color: string; iconName: string }> = {
      google: { color: '#4285F4', iconName: 'google' },
      github: { color: '#333333', iconName: 'github' },
      microsoft: { color: '#00A4EF', iconName: 'microsoft' },
      discord: { color: '#5865F2', iconName: 'discord' },
    };

    return branding[provider.toLowerCase()] || { color: '#6B7280', iconName: 'key' };
  }
}