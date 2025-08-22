import type { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import { PennyError, ValidationError } from '@penny/shared';
import { ZodError } from 'zod';

const errorHandler: FastifyPluginAsync = async (fastify) => {
  fastify.setErrorHandler((error, request, reply) => {
    const { validation, statusCode = 500 } = error;
    
    // Log error
    if (statusCode >= 500) {
      request.log.error({ err: error, requestId: request.id }, 'Server error');
    } else {
      request.log.warn({ err: error, requestId: request.id }, 'Client error');
    }

    // Handle Fastify validation errors
    if (validation) {
      return reply.status(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Request validation failed',
          details: validation,
          traceId: request.id,
        },
      });
    }

    // Handle Zod validation errors
    if (error instanceof ZodError) {
      return reply.status(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Request validation failed',
          details: error.flatten(),
          traceId: request.id,
        },
      });
    }

    // Handle custom PennyError
    if (error instanceof PennyError) {
      return reply.status(error.statusCode).send({
        error: {
          code: error.code,
          message: error.message,
          details: error.details,
          traceId: request.id,
        },
      });
    }

    // Handle rate limit errors
    if (statusCode === 429) {
      return reply.status(429).send({
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: error.message || 'Too many requests',
          traceId: request.id,
        },
      });
    }

    // Default error response
    const message = statusCode < 500 ? error.message : 'Internal server error';
    return reply.status(statusCode).send({
      error: {
        code: 'INTERNAL_ERROR',
        message,
        traceId: request.id,
      },
    });
  });
};

export default fp(errorHandler, {
  name: 'error-handler',
});