import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { ValidationError, AuthenticationError, type Role } from '@penny/shared';
import { PasswordService, JWTService, SessionService, type SessionData } from '@penny/security';
import { prisma } from '@penny/database';
import { generateId } from '@penny/shared';
import crypto from 'node:crypto';

// Validation schemas
const signupSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128, 'Password too long'),
  name: z.string().min(1, 'Name is required').max(255, 'Name too long'),
  tenantName: z.string().min(1, 'Tenant name is required').max(255, 'Tenant name too long'),
});

const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
  tenantId: z.string().uuid().optional(),
  rememberMe: z.boolean().optional().default(false),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

const resetPasswordRequestSchema = z.object({
  email: z.string().email('Invalid email format'),
});

const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128, 'Password too long'),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters').max(128, 'Password too long'),
});

const verifyEmailSchema = z.object({
  token: z.string().min(1, 'Verification token is required'),
});

const routes: FastifyPluginAsync = async (fastify) => {
  const jwtService = new JWTService(
    process.env.JWT_SECRET || 'change-this-jwt-secret-in-production-must-be-at-least-32-chars',
    'penny-platform',
    'penny-users'
  );

  // Rate limiting for auth endpoints
  const rateLimiter = {
    max: 5,
    timeWindow: '1 minute',
  };

  // Register new user and tenant
  fastify.post(
    '/register',
    {
      config: {
        rateLimit: rateLimiter,
      },
      schema: {
        description: 'Register new user and tenant',
        tags: ['auth'],
        body: signupSchema,
        response: {
          201: {
            type: 'object',
            properties: {
              user: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  email: { type: 'string' },
                  name: { type: 'string' },
                  emailVerified: { type: 'boolean' },
                },
              },
              tenant: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  name: { type: 'string' },
                  slug: { type: 'string' },
                },
              },
              accessToken: { type: 'string' },
              refreshToken: { type: 'string' },
              expiresIn: { type: 'number' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const body = signupSchema.parse(request.body);
      
      // Validate password strength
      if (!PasswordService.validatePassword(body.password)) {
        throw new ValidationError('Password does not meet security requirements');
      }

      // Check if password is compromised
      const isCompromised = await PasswordService.isPasswordCompromised(body.password);
      if (isCompromised) {
        throw new ValidationError('This password has been found in data breaches. Please choose a different password.');
      }

      try {
        // Check if user already exists
        const existingUser = await prisma.user.findFirst({
          where: { email: body.email.toLowerCase() },
        });

        if (existingUser) {
          throw new ValidationError('User with this email already exists');
        }

        // Generate tenant slug
        const baseSlug = body.tenantName.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');
        let tenantSlug = baseSlug;
        let counter = 1;
        
        while (await prisma.tenant.findUnique({ where: { slug: tenantSlug } })) {
          tenantSlug = `${baseSlug}-${counter}`;
          counter++;
        }

        // Hash password
        const passwordHash = await PasswordService.hashPassword(body.password);
        
        // Generate IDs
        const userId = generateId('usr');
        const tenantId = generateId('tnt');
        const sessionId = generateId('ses');
        
        // Create tenant and user in transaction
        const result = await prisma.$transaction(async (tx) => {
          // Create tenant
          const tenant = await tx.tenant.create({
            data: {
              id: tenantId,
              name: body.tenantName,
              slug: tenantSlug,
              settings: {},
              features: {},
              limits: {
                maxUsers: 10,
                maxConversations: 1000,
                maxArtifacts: 5000,
              },
            },
          });

          // Create user
          const user = await tx.user.create({
            data: {
              id: userId,
              tenantId: tenant.id,
              email: body.email.toLowerCase(),
              name: body.name,
              passwordHash,
              emailVerified: null, // Will be verified via email
              isActive: true,
            },
          });

          // Create admin role for the user
          const adminRole = await tx.role.findFirst({
            where: { name: 'admin', isSystem: true },
          });

          if (adminRole) {
            await tx.userRole.create({
              data: {
                userId: user.id,
                roleId: adminRole.id,
              },
            });
          }

          // Create default workspace
          await tx.workspace.create({
            data: {
              tenantId: tenant.id,
              name: 'General',
              isDefault: true,
            },
          });

          return { user, tenant };
        });

        // Generate session
        const sessionData = SessionService.createSession({
          userId: result.user.id,
          tenantId: result.tenant.id,
          ipAddress: request.ip,
          userAgent: request.headers['user-agent'],
        });

        // Create session in database
        await prisma.session.create({
          data: {
            id: sessionId,
            userId: result.user.id,
            sessionToken: sessionData.sessionToken,
            expires: sessionData.expires,
            ipAddress: sessionData.ipAddress,
            userAgent: sessionData.userAgent,
          },
        });

        // Generate tokens
        const { accessToken, refreshToken } = await jwtService.generateTokenPair(
          result.user.id,
          result.tenant.id,
          ['admin'] as Role[],
          sessionId
        );

        // Log registration event
        await prisma.auditLog.create({
          data: {
            tenantId: result.tenant.id,
            userId: result.user.id,
            action: 'auth.register',
            resource: 'user',
            metadata: {
              email: result.user.email,
              tenantName: result.tenant.name,
              timestamp: new Date().toISOString(),
            },
            ipAddress: request.ip,
            userAgent: request.headers['user-agent'],
          },
        });

        reply.code(201);
        return {
          user: {
            id: result.user.id,
            email: result.user.email,
            name: result.user.name,
            emailVerified: Boolean(result.user.emailVerified),
          },
          tenant: {
            id: result.tenant.id,
            name: result.tenant.name,
            slug: result.tenant.slug,
          },
          accessToken,
          refreshToken,
          expiresIn: 15 * 60, // 15 minutes
        };
      } catch (error) {
        if (error instanceof ValidationError) {
          throw error;
        }
        fastify.log.error('Registration error:', error);
        throw new AuthenticationError('Registration failed');
      }
    },
  );

  // Login with email and password
  fastify.post(
    '/login',
    {
      config: {
        rateLimit: rateLimiter,
      },
      schema: {
        description: 'Login with email and password',
        tags: ['auth'],
        body: loginSchema,
        response: {
          200: {
            type: 'object',
            properties: {
              user: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  email: { type: 'string' },
                  name: { type: 'string' },
                  avatar: { type: 'string', nullable: true },
                  roles: { type: 'array', items: { type: 'string' } },
                  lastLoginAt: { type: 'string' },
                },
              },
              tenant: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  name: { type: 'string' },
                  slug: { type: 'string' },
                },
              },
              accessToken: { type: 'string' },
              refreshToken: { type: 'string' },
              expiresIn: { type: 'number' },\n            },
          },
        },
      },
    },
    async (request, reply) => {
      const body = loginSchema.parse(request.body);
      
      try {\n        // Find user by email\n        const user = await prisma.user.findFirst({\n          where: {\n            email: body.email.toLowerCase(),\n            isActive: true,\n          },\n          include: {\n            tenant: true,\n            roles: {\n              include: {\n                role: true,\n              },\n            },\n          },\n        });\n\n        if (!user || !user.passwordHash) {\n          throw new AuthenticationError('Invalid email or password');\n        }\n\n        // Verify password\n        const isPasswordValid = await PasswordService.verifyPassword(body.password, user.passwordHash);\n        if (!isPasswordValid) {\n          // Log failed login attempt\n          await prisma.auditLog.create({\n            data: {\n              tenantId: user.tenantId,\n              action: 'auth.login_failed',\n              resource: 'user',\n              metadata: {\n                email: body.email,\n                reason: 'invalid_password',\n                timestamp: new Date().toISOString(),\n              },\n              ipAddress: request.ip,\n              userAgent: request.headers['user-agent'],\n            },\n          });\n          \n          throw new AuthenticationError('Invalid email or password');\n        }\n\n        // Check if specific tenant is requested\n        if (body.tenantId && user.tenantId !== body.tenantId) {\n          throw new AuthenticationError('User does not belong to specified tenant');\n        }\n\n        // Generate session\n        const sessionId = generateId('ses');\n        const sessionData = SessionService.createSession({\n          userId: user.id,\n          tenantId: user.tenantId,\n          ipAddress: request.ip,\n          userAgent: request.headers['user-agent'],\n          expiresInDays: body.rememberMe ? 30 : 1, // Longer session if remember me\n        });\n\n        // Create session in database\n        await prisma.session.create({\n          data: {\n            id: sessionId,\n            userId: user.id,\n            sessionToken: sessionData.sessionToken,\n            expires: sessionData.expires,\n            ipAddress: sessionData.ipAddress,\n            userAgent: sessionData.userAgent,\n          },\n        });\n\n        // Update last login\n        await prisma.user.update({\n          where: { id: user.id },\n          data: { lastLoginAt: new Date() },\n        });\n\n        // Get user roles\n        const roles = user.roles.map(ur => ur.role.name as Role);\n\n        // Generate tokens\n        const tokenExpiry = body.rememberMe ? '7d' : '15m';\n        const { accessToken, refreshToken } = await jwtService.generateTokenPair(\n          user.id,\n          user.tenantId,\n          roles,\n          sessionId,\n          tokenExpiry\n        );\n\n        // Log successful login\n        await prisma.auditLog.create({\n          data: {\n            tenantId: user.tenantId,\n            userId: user.id,\n            action: 'auth.login',\n            resource: 'session',\n            metadata: {\n              sessionId,\n              rememberMe: body.rememberMe,\n              timestamp: new Date().toISOString(),\n            },\n            ipAddress: request.ip,\n            userAgent: request.headers['user-agent'],\n          },\n        });\n\n        return {\n          user: {\n            id: user.id,\n            email: user.email,\n            name: user.name,\n            avatar: user.avatar,\n            roles,\n            lastLoginAt: user.lastLoginAt?.toISOString(),\n          },\n          tenant: {\n            id: user.tenant.id,\n            name: user.tenant.name,\n            slug: user.tenant.slug,\n          },\n          accessToken,\n          refreshToken,\n          expiresIn: body.rememberMe ? 7 * 24 * 60 * 60 : 15 * 60, // seconds\n        };\n      } catch (error) {\n        if (error instanceof AuthenticationError || error instanceof ValidationError) {\n          throw error;\n        }\n        fastify.log.error('Login error:', error);\n        throw new AuthenticationError('Login failed');\n      }\n    },\n  );

  // Refresh access token
  fastify.post(
    '/refresh',
    {
      schema: {
        description: 'Refresh access token using refresh token',
        tags: ['auth'],
        body: refreshSchema,
        response: {
          200: {
            type: 'object',
            properties: {
              accessToken: { type: 'string' },
              refreshToken: { type: 'string' },
              expiresIn: { type: 'number' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const body = refreshSchema.parse(request.body);
      
      try {
        // Verify refresh token
        const payload = await jwtService.verifyRefreshToken(body.refreshToken);
        
        // Find session
        const session = await prisma.session.findUnique({
          where: { id: payload.sessionId },
          include: {
            user: {
              include: {
                roles: {
                  include: {
                    role: true,
                  },
                },
              },
            },
          },
        });

        if (!session || !session.user.isActive || session.expires < new Date()) {
          throw new AuthenticationError('Invalid or expired refresh token');
        }

        // Get user roles
        const roles = session.user.roles.map(ur => ur.role.name as Role);

        // Generate new token pair
        const { accessToken, refreshToken } = await jwtService.generateTokenPair(
          session.user.id,
          session.user.tenantId,
          roles,
          session.id
        );

        // Update session last accessed time
        await prisma.session.update({
          where: { id: session.id },
          data: { updatedAt: new Date() },
        });

        return {
          accessToken,
          refreshToken,
          expiresIn: 15 * 60, // 15 minutes
        };
      } catch (error) {
        if (error instanceof AuthenticationError) {
          throw error;
        }
        fastify.log.error('Token refresh error:', error);
        throw new AuthenticationError('Token refresh failed');
      }
    },
  );

  // Logout and invalidate session
  fastify.post(
    '/logout',
    {
      schema: {
        description: 'Logout and invalidate current session',
        tags: ['auth'],
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
            },
          },
        },
      },
      preHandler: fastify.authenticate,
    },
    async (request, reply) => {
      try {
        const { userId, sessionId, tenantId } = request.context;

        // Invalidate session in database
        await prisma.session.update({
          where: { id: sessionId },
          data: { 
            expires: new Date(), // Set to past date to invalidate
          },
        });

        // Log logout event
        await prisma.auditLog.create({
          data: {
            tenantId,
            userId,
            action: 'auth.logout',
            resource: 'session',
            metadata: {
              sessionId,
              timestamp: new Date().toISOString(),
            },
            ipAddress: request.ip,
            userAgent: request.headers['user-agent'],
          },
        });

        return { success: true };
      } catch (error) {
        fastify.log.error('Logout error:', error);
        throw new AuthenticationError('Logout failed');
      }
    },
  );

  // Get current user profile
  fastify.get(
    '/me',
    {
      schema: {
        description: 'Get current authenticated user profile',
        tags: ['auth'],
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: 'object',
            properties: {
              user: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  email: { type: 'string' },
                  name: { type: 'string' },
                  avatar: { type: 'string', nullable: true },
                  locale: { type: 'string' },
                  timezone: { type: 'string' },
                  theme: { type: 'string' },
                  roles: { type: 'array', items: { type: 'string' } },
                  lastLoginAt: { type: 'string', nullable: true },
                  createdAt: { type: 'string' },
                },
              },
              tenant: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  name: { type: 'string' },
                  slug: { type: 'string' },
                  logo: { type: 'string', nullable: true },
                  primaryColor: { type: 'string' },
                },
              },
            },
          },
        },
      },
      preHandler: fastify.authenticate,
    },
    async (request, reply) => {
      try {
        const { userId, tenantId } = request.context;

        // Fetch user with roles
        const user = await prisma.user.findUnique({
          where: { id: userId },
          include: {
            tenant: true,
            roles: {
              include: {
                role: true,
              },
            },
          },
        });

        if (!user) {
          throw new AuthenticationError('User not found');
        }

        const roles = user.roles.map(ur => ur.role.name);

        return {
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            avatar: user.avatar,
            locale: user.locale,
            timezone: user.timezone,
            theme: user.theme,
            roles,
            lastLoginAt: user.lastLoginAt?.toISOString(),
            createdAt: user.createdAt.toISOString(),
          },
          tenant: {
            id: user.tenant.id,
            name: user.tenant.name,
            slug: user.tenant.slug,
            logo: user.tenant.logo,
            primaryColor: user.tenant.primaryColor,
          },
        };
      } catch (error) {
        if (error instanceof AuthenticationError) {
          throw error;
        }
        fastify.log.error('Get profile error:', error);
        throw new AuthenticationError('Failed to get user profile');
      }
    },
  );

  // Request password reset
  fastify.post(
    '/forgot-password',
    {
      config: {
        rateLimit: {
          max: 3,
          timeWindow: '1 hour',
        },
      },
      schema: {
        description: 'Request password reset email',
        tags: ['auth'],
        body: resetPasswordRequestSchema,
        response: {
          200: {
            type: 'object',
            properties: {
              message: { type: 'string' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const body = resetPasswordRequestSchema.parse(request.body);
      
      try {
        const user = await prisma.user.findFirst({
          where: {
            email: body.email.toLowerCase(),
            isActive: true,
          },
        });

        // Always return success to prevent user enumeration
        // In production, you would send an email here
        if (user) {
          const resetToken = PasswordService.generateResetToken();
          const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

          // Store reset token (in production, use VerificationToken model)
          await prisma.verificationToken.create({
            data: {
              identifier: user.email,
              token: resetToken,
              expires: expiresAt,
            },
          });

          // Log password reset request
          await prisma.auditLog.create({
            data: {
              tenantId: user.tenantId,
              userId: user.id,
              action: 'auth.password_reset_requested',
              resource: 'user',
              metadata: {
                email: user.email,
                timestamp: new Date().toISOString(),
              },
              ipAddress: request.ip,
              userAgent: request.headers['user-agent'],
            },
          });

          // TODO: Send email with reset link containing resetToken
          fastify.log.info(`Password reset requested for ${user.email}, token: ${resetToken}`);
        }

        return {
          message: 'If an account with that email exists, we have sent a password reset link.',
        };
      } catch (error) {
        fastify.log.error('Password reset request error:', error);
        return {
          message: 'If an account with that email exists, we have sent a password reset link.',
        };
      }
    },
  );

  // Reset password with token
  fastify.post(
    '/reset-password',
    {
      config: {
        rateLimit: rateLimiter,
      },
      schema: {
        description: 'Reset password using reset token',
        tags: ['auth'],
        body: resetPasswordSchema,
        response: {
          200: {
            type: 'object',
            properties: {
              message: { type: 'string' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const body = resetPasswordSchema.parse(request.body);
      
      // Validate password strength
      if (!PasswordService.validatePassword(body.password)) {
        throw new ValidationError('Password does not meet security requirements');
      }

      try {
        // Find and verify reset token
        const resetToken = await prisma.verificationToken.findUnique({
          where: { token: body.token },
        });

        if (!resetToken || resetToken.expires < new Date()) {
          throw new ValidationError('Invalid or expired reset token');
        }

        // Find user by email from token
        const user = await prisma.user.findFirst({
          where: {
            email: resetToken.identifier,
            isActive: true,
          },
        });

        if (!user) {
          throw new ValidationError('Invalid reset token');
        }

        // Hash new password
        const passwordHash = await PasswordService.hashPassword(body.password);

        // Update password and remove reset token
        await prisma.$transaction([
          prisma.user.update({
            where: { id: user.id },
            data: { passwordHash },
          }),
          prisma.verificationToken.delete({
            where: { token: body.token },
          }),
          // Invalidate all existing sessions for security
          prisma.session.updateMany({
            where: { userId: user.id },
            data: { expires: new Date() },
          }),
        ]);

        // Log password reset completion
        await prisma.auditLog.create({
          data: {
            tenantId: user.tenantId,
            userId: user.id,
            action: 'auth.password_reset_completed',
            resource: 'user',
            metadata: {
              timestamp: new Date().toISOString(),
            },
            ipAddress: request.ip,
            userAgent: request.headers['user-agent'],
          },
        });

        return {
          message: 'Password has been reset successfully. Please log in with your new password.',
        };
      } catch (error) {
        if (error instanceof ValidationError) {
          throw error;
        }
        fastify.log.error('Password reset error:', error);
        throw new ValidationError('Password reset failed');
      }
    },
  );

  // Change password for authenticated user
  fastify.post(
    '/change-password',
    {
      schema: {
        description: 'Change password for authenticated user',
        tags: ['auth'],
        security: [{ bearerAuth: [] }],
        body: changePasswordSchema,
        response: {
          200: {
            type: 'object',
            properties: {
              message: { type: 'string' },
            },
          },
        },
      },
      preHandler: fastify.authenticate,
    },
    async (request, reply) => {
      const body = changePasswordSchema.parse(request.body);
      const { userId } = request.context;
      
      // Validate new password strength
      if (!PasswordService.validatePassword(body.newPassword)) {
        throw new ValidationError('New password does not meet security requirements');
      }

      try {
        // Get current user
        const user = await prisma.user.findUnique({
          where: { id: userId },
        });

        if (!user || !user.passwordHash) {
          throw new AuthenticationError('User not found');
        }

        // Verify current password
        const isCurrentPasswordValid = await PasswordService.verifyPassword(
          body.currentPassword, 
          user.passwordHash
        );
        
        if (!isCurrentPasswordValid) {
          throw new ValidationError('Current password is incorrect');
        }

        // Check if new password is different
        const isSamePassword = await PasswordService.verifyPassword(
          body.newPassword,
          user.passwordHash
        );
        
        if (isSamePassword) {
          throw new ValidationError('New password must be different from current password');
        }

        // Hash new password
        const newPasswordHash = await PasswordService.hashPassword(body.newPassword);

        // Update password
        await prisma.user.update({
          where: { id: userId },
          data: { passwordHash: newPasswordHash },
        });

        // Log password change
        await prisma.auditLog.create({
          data: {
            tenantId: user.tenantId,
            userId: user.id,
            action: 'auth.password_changed',
            resource: 'user',
            metadata: {
              timestamp: new Date().toISOString(),
            },
            ipAddress: request.ip,
            userAgent: request.headers['user-agent'],
          },
        });

        return {
          message: 'Password changed successfully',
        };
      } catch (error) {
        if (error instanceof ValidationError || error instanceof AuthenticationError) {
          throw error;
        }
        fastify.log.error('Change password error:', error);
        throw new ValidationError('Password change failed');
      }
    },
  );

  // Verify email with token
  fastify.post(
    '/verify-email',
    {
      schema: {
        description: 'Verify email address using verification token',
        tags: ['auth'],
        body: verifyEmailSchema,
        response: {
          200: {
            type: 'object',
            properties: {
              message: { type: 'string' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const body = verifyEmailSchema.parse(request.body);
      
      try {
        // Find verification token
        const verifyToken = await prisma.verificationToken.findUnique({
          where: { token: body.token },
        });

        if (!verifyToken || verifyToken.expires < new Date()) {
          throw new ValidationError('Invalid or expired verification token');
        }

        // Find and update user
        const user = await prisma.user.findFirst({
          where: { email: verifyToken.identifier },
        });

        if (!user) {
          throw new ValidationError('Invalid verification token');
        }

        // Mark email as verified and remove token
        await prisma.$transaction([
          prisma.user.update({
            where: { id: user.id },
            data: { emailVerified: new Date() },
          }),
          prisma.verificationToken.delete({
            where: { token: body.token },
          }),
        ]);

        // Log email verification
        await prisma.auditLog.create({
          data: {
            tenantId: user.tenantId,
            userId: user.id,
            action: 'auth.email_verified',
            resource: 'user',
            metadata: {
              email: user.email,
              timestamp: new Date().toISOString(),
            },
            ipAddress: request.ip,
            userAgent: request.headers['user-agent'],
          },
        });

        return {
          message: 'Email verified successfully',
        };
      } catch (error) {
        if (error instanceof ValidationError) {
          throw error;
        }
        fastify.log.error('Email verification error:', error);
        throw new ValidationError('Email verification failed');
      }
    },
  );

  // Get user sessions
  fastify.get(
    '/sessions',
    {
      schema: {
        description: 'Get all active sessions for current user',
        tags: ['auth'],
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: 'object',
            properties: {
              sessions: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    deviceInfo: { type: 'string', nullable: true },
                    ipAddress: { type: 'string', nullable: true },
                    lastAccessedAt: { type: 'string' },
                    createdAt: { type: 'string' },
                    isCurrent: { type: 'boolean' },
                  },
                },
              },
            },
          },
        },
      },
      preHandler: fastify.authenticate,
    },
    async (request, reply) => {
      try {
        const { userId, sessionId } = request.context;

        const sessions = await prisma.session.findMany({
          where: {
            userId,
            expires: { gt: new Date() },
          },
          orderBy: { createdAt: 'desc' },
        });

        const sessionList = sessions.map(session => ({
          id: session.id,
          deviceInfo: session.userAgent,
          ipAddress: session.ipAddress,
          lastAccessedAt: session.updatedAt.toISOString(),
          createdAt: session.createdAt.toISOString(),
          isCurrent: session.id === sessionId,
        }));

        return { sessions: sessionList };
      } catch (error) {
        fastify.log.error('Get sessions error:', error);
        throw new AuthenticationError('Failed to get sessions');
      }
    },
  );

  // Revoke session
  fastify.delete(
    '/sessions/:sessionId',
    {
      schema: {
        description: 'Revoke a specific session',
        tags: ['auth'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          properties: {
            sessionId: { type: 'string' },
          },
          required: ['sessionId'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              message: { type: 'string' },
            },
          },
        },
      },
      preHandler: fastify.authenticate,
    },
    async (request, reply) => {
      try {
        const { userId, tenantId } = request.context;
        const { sessionId } = request.params as { sessionId: string };

        // Verify session belongs to user
        const session = await prisma.session.findUnique({
          where: { id: sessionId },
        });

        if (!session || session.userId !== userId) {
          throw new ValidationError('Session not found');
        }

        // Invalidate session
        await prisma.session.update({
          where: { id: sessionId },
          data: { expires: new Date() },
        });

        // Log session revocation
        await prisma.auditLog.create({
          data: {
            tenantId,
            userId,
            action: 'auth.session_revoked',
            resource: 'session',
            metadata: {
              revokedSessionId: sessionId,
              timestamp: new Date().toISOString(),
            },
            ipAddress: request.ip,
            userAgent: request.headers['user-agent'],
          },
        });

        return {
          message: 'Session revoked successfully',
        };
      } catch (error) {
        if (error instanceof ValidationError) {
          throw error;
        }
        fastify.log.error('Revoke session error:', error);
        throw new AuthenticationError('Failed to revoke session');
      }
    },
  );
};

export default routes;
