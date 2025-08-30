import { z } from 'zod';
export declare const emailSchema: z.ZodEffects<z.ZodString, string, string>;
export declare const passwordSchema: z.ZodString;
export declare const usernameSchema: z.ZodString;
export declare const uuidSchema: z.ZodString;
export declare const urlSchema: z.ZodString;
export declare const phoneSchema: z.ZodString;
export declare function sanitizeInput<T>(schema: z.ZodSchema<T>, data: unknown): {
    success: true;
    data: T;
} | {
    success: false;
    errors: z.ZodError;
};
export declare function escapeSqlIdentifier(identifier: string): string;
export declare function sanitizePath(path: string): string;
export declare function getRateLimitKey(resource: string, identifier: string, window: number): string;
//# sourceMappingURL=index.d.ts.map