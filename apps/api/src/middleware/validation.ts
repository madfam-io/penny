import type { FastifyRequest, FastifyReply, HookHandlerDoneFunction } from 'fastify';
import { z } from 'zod';\nimport { sanitizeInput } from '@penny/security';

// Common validation schemas
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

export const idParamSchema = z.object({
  id: z.string().cuid(),
});

export const searchQuerySchema = z.object({
  q: z.string().min(1).max(100),
  filters: z.record(z.string()).optional(),
});

// Validation middleware factory
export function validateRequest(schema: {
  body?: z.ZodSchema;
  querystring?: z.ZodSchema;
  params?: z.ZodSchema;
  headers?: z.ZodSchema;
}) {
  return async (request: FastifyRequest, reply: FastifyReply, done: HookHandlerDoneFunction) => {
    try {
      // Validate and sanitize body
      if (schema.body && request.body) {
        const parsed = schema.body.parse(request.body);
        request.body = sanitizeRequestData(parsed);
      }

      // Validate and sanitize query parameters
      if (schema.querystring && request.query) {
        const parsed = schema.querystring.parse(request.query);
        request.query = sanitizeRequestData(parsed);
      }

      // Validate params (usually IDs, no sanitization needed)
      if (schema.params && request.params) {
        request.params = schema.params.parse(request.params);
      }

      // Validate headers
      if (schema.headers && request.headers) {
        schema.headers.parse(request.headers);
      }

      done();
    } catch (error) {
      if (error instanceof z.ZodError) {
        reply.code(400).send({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request data',
            details: error.errors.map((err) => ({\n              path: err.path.join('.'),
              message: err.message,
              code: err.code,
            })),
          },
        });
      } else {
        done(error as Error);
      }
    }
  };
}

// Sanitize request data recursively
function sanitizeRequestData(data: any): any {
  if (typeof data === 'string') {
    return sanitizeInput(data);
  }

  if (Array.isArray(data)) {
    return data.map((item) => sanitizeRequestData(item));
  }

  if (data && typeof data === 'object') {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(data)) {
      // Skip sensitive fields from sanitization
      if (['password', 'token', 'secret', 'apiKey'].includes(key)) {
        sanitized[key] = value;
      } else {
        sanitized[key] = sanitizeRequestData(value);
      }
    }
    return sanitized;
  }

  return data;
}

// Content security validation
export function validateContentSecurity(
  request: FastifyRequest,
  reply: FastifyReply,
  done: HookHandlerDoneFunction,
) {
  const contentType = request.headers['content-type'];

  // Prevent XXE attacks
  if (contentType?.includes('xml')) {
    reply.code(415).send({
      error: {
        code: 'UNSUPPORTED_MEDIA_TYPE',
        message: 'XML content is not supported',
      },
    });
    return;
  }

  // Validate JSON depth to prevent DoS
  if (contentType?.includes('json') && request.body) {
    const depth = getObjectDepth(request.body);
    if (depth > 10) {
      reply.code(400).send({
        error: {
          code: 'INVALID_REQUEST',
          message: 'Request body is too deeply nested',
        },
      });
      return;
    }
  }

  done();
}

// Calculate object nesting depth
function getObjectDepth(obj: any): number {
  if (obj === null || typeof obj !== 'object') {
    return 0;
  }

  const values = Array.isArray(obj) ? obj : Object.values(obj);
  if (values.length === 0) {
    return 1;
  }

  return 1 + Math.max(...values.map((v) => getObjectDepth(v)));
}

// File upload validation
export const fileUploadSchema = z.object({
  filename: z.string().max(255),
  mimetype: z.string(),
  size: z.number().max(100 * 1024 * 1024), // 100MB max
});

// Validate file uploads
export function validateFileUpload(file: any) {
  // Check file extension
  const allowedExtensions = [\n    '.jpg',\n    '.jpeg',\n    '.png',\n    '.gif',\n    '.webp', // Images\n    '.pdf',\n    '.doc',\n    '.docx',\n    '.txt', // Documents\n    '.csv',\n    '.xlsx',\n    '.xls', // Spreadsheets\n    '.json',\n    '.xml',\n    '.yaml',\n    '.yml', // Data files
  ];
\n  const ext = file.filename.toLowerCase().substring(file.filename.lastIndexOf('.'));
  if (!allowedExtensions.includes(ext)) {
    throw new Error(`File type ${ext} is not allowed`);
  }

  // Validate MIME type matches extension
  const mimeTypeMap: Record<string, string[]> = {\n    '.jpg': ['image/jpeg'],\n    '.jpeg': ['image/jpeg'],\n    '.png': ['image/png'],\n    '.gif': ['image/gif'],\n    '.webp': ['image/webp'],\n    '.pdf': ['application/pdf'],\n    '.doc': ['application/msword'],\n    '.docx': ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],\n    '.txt': ['text/plain'],\n    '.csv': ['text/csv'],\n    '.xlsx': ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],\n    '.xls': ['application/vnd.ms-excel'],\n    '.json': ['application/json'],\n    '.xml': ['application/xml', 'text/xml'],\n    '.yaml': ['application/x-yaml', 'text/yaml'],\n    '.yml': ['application/x-yaml', 'text/yaml'],
  };

  const allowedMimeTypes = mimeTypeMap[ext];
  if (!allowedMimeTypes?.includes(file.mimetype)) {
    throw new Error('File MIME type does not match extension');
  }

  return true;
}
