export class PennyError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number = 500,
    public details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'PennyError';
  }
}

export class ValidationError extends PennyError {
  constructor(message: string, details?: Record<string, unknown>) {
    super('VALIDATION_ERROR', message, 400, details);
    this.name = 'ValidationError';
  }
}

export class AuthenticationError extends PennyError {
  constructor(message: string = 'Authentication required') {
    super('AUTHENTICATION_ERROR', message, 401);
    this.name = 'AuthenticationError';
  }
}

export class AuthorizationError extends PennyError {
  constructor(message: string = 'Insufficient permissions') {
    super('AUTHORIZATION_ERROR', message, 403);
    this.name = 'AuthorizationError';
  }
}

export class NotFoundError extends PennyError {
  constructor(resource: string, id?: string) {
    const message = id ? `${resource} with id ${id} not found` : `${resource} not found`;
    super('NOT_FOUND', message, 404);
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends PennyError {
  constructor(message: string, details?: Record<string, unknown>) {
    super('CONFLICT', message, 409, details);
    this.name = 'ConflictError';
  }
}

export class RateLimitError extends PennyError {
  constructor(
    public retryAfter: number,
    message: string = 'Rate limit exceeded',
  ) {
    super('RATE_LIMIT_EXCEEDED', message, 429, { retryAfter });
    this.name = 'RateLimitError';
  }
}

export class TenantQuotaError extends PennyError {
  constructor(
    public resource: string,
    public limit: number,
    public current: number,
  ) {
    super(
      'TENANT_QUOTA_EXCEEDED',
      `Tenant quota exceeded for ${resource}. Limit: ${limit}, Current: ${current}`,
      429,
      { resource, limit, current },
    );
    this.name = 'TenantQuotaError';
  }
}
