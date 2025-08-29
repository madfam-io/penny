import { Prisma } from '@prisma/client';

// Pagination helpers
export interface PaginationParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export function getPaginationParams(params: PaginationParams) {
  const page = Math.max(1, params.page || 1);
  const limit = Math.min(100, Math.max(1, params.limit || 20));
  const skip = (page - 1) * limit;

  return { page, limit, skip };
}

export function createPaginatedResult<T>(
  items: T[],
  total: number,
  params: PaginationParams,
): PaginatedResult<T> {
  const { page, limit } = getPaginationParams(params);
  const totalPages = Math.ceil(total / limit);

  return {
    items,
    total,
    page,
    limit,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1,
  };
}

// Error handling
export function handlePrismaError(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    switch (error.code) {
      case 'P2002':
        throw new Error(`Unique constraint violation: ${error.meta?.target}`);
      case 'P2003':
        throw new Error(`Foreign key constraint violation: ${error.meta?.field_name}`);
      case 'P2025':
        throw new Error('Record not found');
      default:
        throw new Error(`Database error: ${error.message}`);
    }
  }

  if (error instanceof Prisma.PrismaClientValidationError) {
    throw new Error(`Validation error: ${error.message}`);
  }

  throw error;
}

// Transaction helper
export async function withTransaction<T>(
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  try {
    return await prisma.$transaction(fn, {
      maxWait: 5000,
      timeout: 10000,
      isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
    });
  } catch (error) {
    handlePrismaError(error);
  }
}

// Soft delete helper
export function softDeleteWhere(includeDeleted = false) {
  return includeDeleted ? {} : { deletedAt: null };
}

// Search helper
export function searchWhere(searchTerm?: string, fields?: string[]) {
  if (!searchTerm || !fields || fields.length === 0) {
    return {};
  }

  return {
    OR: fields.map((field) => ({
      [field]: {
        contains: searchTerm,
        mode: 'insensitive' as const,
      },
    })),
  };
}

// Date range helper
export function dateRangeWhere(field: string, startDate?: Date | string, endDate?: Date | string) {
  const where: any = {};

  if (startDate) {
    where[field] = { ...where[field], gte: new Date(startDate) };
  }

  if (endDate) {
    where[field] = { ...where[field], lte: new Date(endDate) };
  }

  return Object.keys(where).length > 0 ? where : {};
}

// Bulk operation helpers
export async function bulkCreate<T>(model: any, data: T[], batchSize = 100): Promise<number> {
  let created = 0;

  for (let i = 0; i < data.length; i += batchSize) {
    const batch = data.slice(i, i + batchSize);
    const result = await model.createMany({ data: batch });
    created += result.count;
  }

  return created;
}

// Import prisma instance
import { prisma } from './client.js';
