import { z } from 'zod';
// Common validation schemas
export const emailSchema = z
    .string()
    .email()
    .max(255)
    .transform((email) => email.toLowerCase());
export const passwordSchema = z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must be less than 128 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character');
export const usernameSchema = z
    .string()
    .min(3)
    .max(30)
    .regex(/^[a-zA-Z0-9_-]+$/, 'Username can only contain letters, numbers, underscores, and hyphens');
export const uuidSchema = z.string().uuid();
export const urlSchema = z.string().url();
export const phoneSchema = z.string().regex(/^\+?[1-9]\d{1,14}$/, 'Invalid phone number format');
// Input sanitization helpers
export function sanitizeInput(schema, data) {
    try {
        const validated = schema.parse(data);
        return { success: true, data: validated };
    }
    catch (error) {
        if (error instanceof z.ZodError) {
            return { success: false, errors: error };
        }
        throw error;
    }
}
// SQL injection prevention
export function escapeSqlIdentifier(identifier) {
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(identifier)) {
        throw new Error('Invalid SQL identifier');
    }
    return `"${identifier}"`;
}
// Path traversal prevention
export function sanitizePath(path) {
    // Remove any path traversal attempts
    return path
        .split('/')
        .filter((segment) => segment !== '..' && segment !== '.')
        .join('/');
}
// Rate limiting key generator
export function getRateLimitKey(resource, identifier, window) {
    const timestamp = Math.floor(Date.now() / window) * window;
    return `rate_limit:${resource}:${identifier}:${timestamp}`;
}
//# sourceMappingURL=index.js.map