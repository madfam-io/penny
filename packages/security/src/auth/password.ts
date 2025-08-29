import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';

export class PasswordService {
  private static readonly SALT_ROUNDS = 12;
  private static readonly MIN_PASSWORD_LENGTH = 8;
  private static readonly MAX_PASSWORD_LENGTH = 128;

  /**
   * Hash a password using bcrypt with secure salt rounds
   */
  static async hashPassword(password: string): Promise<string> {
    if (!this.validatePassword(password)) {
      throw new Error('Password does not meet security requirements');
    }
    
    return bcrypt.hash(password, this.SALT_ROUNDS);
  }

  /**
   * Verify a password against its hash
   */
  static async verifyPassword(password: string, hash: string): Promise<boolean> {
    if (!password || !hash) {
      return false;
    }
    
    return bcrypt.compare(password, hash);
  }

  /**
   * Validate password meets security requirements
   */
  static validatePassword(password: string): boolean {
    if (!password) return false;
    
    // Length check
    if (password.length < this.MIN_PASSWORD_LENGTH || password.length > this.MAX_PASSWORD_LENGTH) {
      return false;
    }
    
    // Must contain at least one uppercase letter
    if (!/[A-Z]/.test(password)) return false;
    
    // Must contain at least one lowercase letter
    if (!/[a-z]/.test(password)) return false;
    
    // Must contain at least one digit
    if (!/\d/.test(password)) return false;
    
    // Must contain at least one special character
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>?]/.test(password)) return false;
    
    return true;
  }

  /**
   * Generate a secure random password
   */
  static generateSecurePassword(length: number = 16): string {
    const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let password = '';
    
    // Ensure at least one character from each required category
    const categories = [
      'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
      'abcdefghijklmnopqrstuvwxyz',
      '0123456789',
      '!@#$%^&*'
    ];
    
    // Add one character from each category
    for (const category of categories) {
      const randomIndex = crypto.randomInt(0, category.length);
      password += category[randomIndex];
    }
    
    // Fill the rest with random characters
    for (let i = password.length; i < length; i++) {
      const randomIndex = crypto.randomInt(0, charset.length);
      password += charset[randomIndex];
    }
    
    // Shuffle the password
    return password.split('').sort(() => Math.random() - 0.5).join('');
  }

  /**
   * Generate a secure reset token
   */
  static generateResetToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Generate email verification token
   */
  static generateVerificationToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Check if password has been compromised (basic implementation)
   * In production, you might want to integrate with HaveIBeenPwned API
   */
  static async isPasswordCompromised(password: string): Promise<boolean> {
    // This is a basic implementation
    // In production, you would check against known compromised passwords
    const commonPasswords = [
      'password', '123456', '123456789', 'qwerty', 'abc123', 
      'password123', 'admin', 'letmein', 'welcome', 'monkey'
    ];
    
    return commonPasswords.includes(password.toLowerCase());
  }

  /**
   * Calculate password strength score (0-100)
   */
  static calculatePasswordStrength(password: string): {
    score: number;
    feedback: string[];
  } {
    const feedback: string[] = [];
    let score = 0;
    
    if (password.length < 8) {
      feedback.push('Password should be at least 8 characters long');
    } else if (password.length >= 12) {
      score += 25;
    } else {
      score += 15;
    }
    
    if (!/[a-z]/.test(password)) {
      feedback.push('Add lowercase letters');
    } else {
      score += 15;
    }
    
    if (!/[A-Z]/.test(password)) {
      feedback.push('Add uppercase letters');
    } else {
      score += 15;
    }
    
    if (!/\d/.test(password)) {
      feedback.push('Add numbers');
    } else {
      score += 15;
    }
    
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>?]/.test(password)) {
      feedback.push('Add special characters');
    } else {
      score += 15;
    }
    
    // Bonus points for length
    if (password.length >= 16) score += 10;
    if (password.length >= 20) score += 5;
    
    // Penalty for common patterns
    if (/123/.test(password) || /abc/i.test(password)) {
      score -= 10;
      feedback.push('Avoid common patterns like 123 or abc');
    }
    
    if (feedback.length === 0) {
      feedback.push('Strong password!');
    }
    
    return { score: Math.max(0, Math.min(100, score)), feedback };
  }
}