import { AuthService } from '../auth/service';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

jest.mock('jsonwebtoken');
jest.mock('bcryptjs');

describe('AuthService', () => {
  let authService: AuthService;

  beforeEach(() => {
    authService = new AuthService({
      jwtSecret: 'test-secret',
      jwtExpiresIn: '1h',
      refreshTokenExpiresIn: '7d',
    });
  });

  describe('generateToken', () => {
    it('should generate a JWT token', () => {
      const mockToken = 'mock-jwt-token';
      (jwt.sign as jest.Mock).mockReturnValue(mockToken);

      const payload = { userId: 'user-123', email: 'test@example.com' };
      const token = authService.generateToken(payload);

      expect(token).toBe(mockToken);
      expect(jwt.sign).toHaveBeenCalledWith(
        payload,
        'test-secret',
        { expiresIn: '1h' }
      );
    });

    it('should generate token with custom expiration', () => {
      const mockToken = 'mock-jwt-token';
      (jwt.sign as jest.Mock).mockReturnValue(mockToken);

      const payload = { userId: 'user-123' };
      const token = authService.generateToken(payload, '24h');

      expect(token).toBe(mockToken);
      expect(jwt.sign).toHaveBeenCalledWith(
        payload,
        'test-secret',
        { expiresIn: '24h' }
      );
    });
  });

  describe('verifyToken', () => {
    it('should verify a valid token', () => {
      const mockPayload = { userId: 'user-123', email: 'test@example.com' };
      (jwt.verify as jest.Mock).mockReturnValue(mockPayload);

      const payload = authService.verifyToken('valid-token');

      expect(payload).toEqual(mockPayload);
      expect(jwt.verify).toHaveBeenCalledWith('valid-token', 'test-secret');
    });

    it('should throw error for invalid token', () => {
      (jwt.verify as jest.Mock).mockImplementation(() => {
        throw new Error('Invalid token');
      });

      expect(() => authService.verifyToken('invalid-token')).toThrow('Invalid token');
    });

    it('should throw error for expired token', () => {
      (jwt.verify as jest.Mock).mockImplementation(() => {
        throw new jwt.TokenExpiredError('Token expired', new Date());
      });

      expect(() => authService.verifyToken('expired-token')).toThrow();
    });
  });

  describe('generateRefreshToken', () => {
    it('should generate a refresh token', () => {
      const mockToken = 'mock-refresh-token';
      (jwt.sign as jest.Mock).mockReturnValue(mockToken);

      const payload = { userId: 'user-123' };
      const token = authService.generateRefreshToken(payload);

      expect(token).toBe(mockToken);
      expect(jwt.sign).toHaveBeenCalledWith(
        payload,
        'test-secret',
        { expiresIn: '7d' }
      );
    });
  });

  describe('hashPassword', () => {
    it('should hash a password', async () => {
      const mockHash = 'hashed-password';
      (bcrypt.hash as jest.Mock).mockResolvedValue(mockHash);

      const hash = await authService.hashPassword('password123');

      expect(hash).toBe(mockHash);
      expect(bcrypt.hash).toHaveBeenCalledWith('password123', 10);
    });

    it('should handle hashing errors', async () => {
      (bcrypt.hash as jest.Mock).mockRejectedValue(new Error('Hashing failed'));

      await expect(authService.hashPassword('password123')).rejects.toThrow('Hashing failed');
    });
  });

  describe('comparePassword', () => {
    it('should return true for matching password', async () => {
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await authService.comparePassword('password123', 'hashed-password');

      expect(result).toBe(true);
      expect(bcrypt.compare).toHaveBeenCalledWith('password123', 'hashed-password');
    });

    it('should return false for non-matching password', async () => {
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      const result = await authService.comparePassword('wrong-password', 'hashed-password');

      expect(result).toBe(false);
    });

    it('should handle comparison errors', async () => {
      (bcrypt.compare as jest.Mock).mockRejectedValue(new Error('Comparison failed'));

      await expect(
        authService.comparePassword('password123', 'hashed-password')
      ).rejects.toThrow('Comparison failed');
    });
  });

  describe('validatePassword', () => {
    it('should validate a strong password', () => {
      const result = authService.validatePassword('StrongP@ss123');
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should reject short password', () => {
      const result = authService.validatePassword('Short1!');
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must be at least 8 characters long');
    });

    it('should reject password without uppercase', () => {
      const result = authService.validatePassword('weakpass123!');
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one uppercase letter');
    });

    it('should reject password without lowercase', () => {
      const result = authService.validatePassword('STRONGPASS123!');
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one lowercase letter');
    });

    it('should reject password without number', () => {
      const result = authService.validatePassword('StrongPass!');
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one number');
    });

    it('should reject password without special character', () => {
      const result = authService.validatePassword('StrongPass123');
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one special character');
    });
  });

  describe('generateSessionToken', () => {
    it('should generate a random session token', () => {
      const token1 = authService.generateSessionToken();
      const token2 = authService.generateSessionToken();

      expect(token1).toHaveLength(64);
      expect(token2).toHaveLength(64);
      expect(token1).not.toBe(token2);
    });
  });

  describe('extractBearerToken', () => {
    it('should extract token from Bearer header', () => {
      const token = authService.extractBearerToken('Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9');
      
      expect(token).toBe('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9');
    });

    it('should return null for invalid header', () => {
      expect(authService.extractBearerToken('Invalid')).toBeNull();
      expect(authService.extractBearerToken('')).toBeNull();
      expect(authService.extractBearerToken('Bearer')).toBeNull();
    });
  });

  describe('createTokenPair', () => {
    it('should create access and refresh token pair', () => {
      (jwt.sign as jest.Mock)
        .mockReturnValueOnce('access-token')
        .mockReturnValueOnce('refresh-token');

      const payload = { userId: 'user-123', email: 'test@example.com' };
      const tokens = authService.createTokenPair(payload);

      expect(tokens).toEqual({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      });
      expect(jwt.sign).toHaveBeenCalledTimes(2);
    });
  });
});