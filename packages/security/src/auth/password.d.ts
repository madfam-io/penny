export declare class PasswordService {
    private static readonly SALT_ROUNDS;
    private static readonly MIN_PASSWORD_LENGTH;
    private static readonly MAX_PASSWORD_LENGTH;
    /**
     * Hash a password using bcrypt with secure salt rounds
     */
    static hashPassword(password: string): Promise<string>;
    /**
     * Verify a password against its hash
     */
    static verifyPassword(password: string, hash: string): Promise<boolean>;
    /**
     * Validate password meets security requirements
     */
    static validatePassword(password: string): boolean;
    /**
     * Generate a secure random password
     */
    static generateSecurePassword(length?: number): string;
    /**
     * Generate a secure reset token
     */
    static generateResetToken(): string;
    /**
     * Generate email verification token
     */
    static generateVerificationToken(): string;
    /**
     * Check if password has been compromised (basic implementation)
     * In production, you might want to integrate with HaveIBeenPwned API
     */
    static isPasswordCompromised(password: string): Promise<boolean>;
    /**
     * Calculate password strength score (0-100)
     */
    static calculatePasswordStrength(password: string): {
        score: number;
        feedback: string[];
    };
}
//# sourceMappingURL=password.d.ts.map