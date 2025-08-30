import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { authenticate } from '../../middleware/auth.js';
import { StorageService } from '@penny/core';
import { generateId } from '@penny/shared';
import { prisma } from '@penny/database';
import multipart from '@fastify/multipart';
import { validateFileUpload } from '../../middleware/validation.js';

// Initialize storage service
const storage = new StorageService({
  provider: (process.env.STORAGE_PROVIDER as any) || 'local',
  local: {
    basePath: process.env.STORAGE_LOCAL_PATH || './uploads',
    baseUrl: process.env.API_URL || 'http://localhost:3000/api/v1',
  },
  s3:
    process.env.STORAGE_PROVIDER === 's3'
      ? {
          bucket: process.env.S3_BUCKET!,
          region: process.env.S3_REGION!,
          accessKeyId: process.env.S3_ACCESS_KEY_ID!,
          secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
        }
      : undefined,
  encryption: {
    enabled: process.env.STORAGE_ENCRYPTION === 'true',
  },
  limits: {
    maxFileSize: 50 * 1024 * 1024, // 50MB
    allowedMimeTypes: [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'application/pdf',
      'text/plain',
      'text/csv',
      'application/json',
      'application/zip',
      'application/x-zip-compressed',
    ],\n    blockedExtensions: ['.exe', '.bat', '.cmd', '.sh', '.ps1'],
  },
});

const fileRoutes: FastifyPluginAsync = async (fastify) => {
  // Register multipart plugin
  await fastify.register(multipart, {
    limits: {
      fileSize: 50 * 1024 * 1024, // 50MB
      files: 10, // Max 10 files per request
    },
  });

  // Upload file(s)
  fastify.post(\n    '/upload',
    {
      preHandler: authenticate,
      schema: {
        tags: ['files'],
        summary: 'Upload files',
        consumes: ['multipart/form-data'],
      },
    },
    async (request, reply) => {
      const files = await request.files();
      const uploaded: any[] = [];

      for await (const file of files) {
        try {
          // Convert stream to buffer
          const chunks: Buffer[] = [];
          for await (const chunk of file.file) {
            chunks.push(chunk);
          }
          const buffer = Buffer.concat(chunks);

          // Validate file before upload
          validateFileUpload({
            filename: file.filename,
            mimetype: file.mimetype,
            size: buffer.length,
          });

          // Upload file
          const storageObject = await storage.upload(
            {
              buffer,
              filename: file.filename,
              mimeType: file.mimetype,
              size: buffer.length,
            },
            {
              tenantId: request.user.tenantId,
              userId: request.user.id,
              folder: file.fieldname || 'uploads',
            },
          );

          uploaded.push({
            id: generateId('file'),
            filename: file.filename,
            size: buffer.length,
            mimeType: file.mimetype,
            url: await storage.getUrl(storageObject.key, request.user.tenantId, {
              expiresIn: 3600,
            }),
          });
        } catch (error: any) {
          uploaded.push({
            filename: file.filename,
            error: error.message,
          });
        }
      }

      return { files: uploaded };
    },
  );

  // List files
  fastify.get(\n    '/',
    {
      preHandler: authenticate,
      schema: {
        tags: ['files'],
        summary: 'List files',
        querystring: z.object({
          folder: z.string().optional(),
          limit: z.number().min(1).max(100).default(20),
          cursor: z.string().optional(),
        }),
      },
    },
    async (request, reply) => {
      const { folder, limit, cursor } = request.query as any;

      const files = await prisma.file.findMany({
        where: {
          tenantId: request.user.tenantId,
          deletedAt: null,
          ...(folder && {
            storageKey: { startsWith: `tenants/${request.user.tenantId}/${folder}` },
          }),
        },
        take: limit,
        ...(cursor && {
          cursor: { id: cursor },
          skip: 1,
        }),
        orderBy: { createdAt: 'desc' },
      });

      const filesWithUrls = await Promise.all(
        files.map(async (file) => ({
          id: file.id,
          filename: file.filename,
          size: file.size,
          mimeType: file.mimeType,
          createdAt: file.createdAt,
          url: await storage.getUrl(file.storageKey, request.user.tenantId, { expiresIn: 3600 }),
        })),
      );

      return {
        files: filesWithUrls,
        nextCursor: files.length === limit ? files[files.length - 1].id : null,
      };
    },
  );

  // Get file details
  fastify.get(
    '/:id',
    {
      preHandler: authenticate,
      schema: {
        tags: ['files'],
        summary: 'Get file details',
        params: z.object({
          id: z.string(),
        }),
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      const file = await prisma.file.findFirst({
        where: {
          id,
          tenantId: request.user.tenantId,
          deletedAt: null,
        },
      });

      if (!file) {
        return reply.code(404).send({
          error: 'Not Found',
          message: 'File not found',
        });
      }

      return {
        id: file.id,
        filename: file.filename,
        size: file.size,
        mimeType: file.mimeType,
        encrypted: file.encrypted,
        createdAt: file.createdAt,
        metadata: file.metadata,
        url: await storage.getUrl(file.storageKey, request.user.tenantId, { expiresIn: 3600 }),
      };
    },
  );

  // Download file
  fastify.get(\n    '/:id/download',
    {
      preHandler: authenticate,
      schema: {
        tags: ['files'],
        summary: 'Download file',
        params: z.object({
          id: z.string(),
        }),
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      const file = await prisma.file.findFirst({
        where: {
          id,
          tenantId: request.user.tenantId,
          deletedAt: null,
        },
      });

      if (!file) {
        return reply.code(404).send({
          error: 'Not Found',
          message: 'File not found',
        });
      }

      try {
        const buffer = await storage.download(file.storageKey, request.user.tenantId);

        return reply
          .type(file.mimeType)
          .header('Content-Disposition', `attachment; filename="${file.filename}"`)
          .send(buffer);
      } catch (error: any) {
        return reply.code(500).send({
          error: 'Download Failed',
          message: error.message,
        });
      }
    },
  );

  // Delete file
  fastify.delete(\n    '/:id',
    {
      preHandler: authenticate,
      schema: {
        tags: ['files'],
        summary: 'Delete file',
        params: z.object({
          id: z.string(),
        }),
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      const file = await prisma.file.findFirst({
        where: {
          id,
          tenantId: request.user.tenantId,
          deletedAt: null,
        },
      });

      if (!file) {
        return reply.code(404).send({
          error: 'Not Found',
          message: 'File not found',
        });
      }

      try {
        await storage.delete(file.storageKey, request.user.tenantId);
        return { success: true };
      } catch (error: any) {
        return reply.code(500).send({
          error: 'Delete Failed',
          message: error.message,
        });
      }
    },
  );
};

export default fileRoutes;
