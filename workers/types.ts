/**
 * Shared TypeScript types for Cloudflare Workers
 */

export interface Env {
  // KV Namespaces
  CACHE: KVNamespace;
  SESSIONS: KVNamespace;
  
  // R2 Buckets
  ARTIFACTS: R2Bucket;
  UPLOADS: R2Bucket;
  EXPORTS: R2Bucket;
  
  // Durable Objects
  RATE_LIMITER: DurableObjectNamespace;
  
  // Environment Variables
  ENVIRONMENT: string;
  API_URL: string;
  JWT_PUBLIC_KEY: string;
  CDN_URL: string;
  
  // Account Settings
  CF_ACCOUNT_ID: string;
  CF_API_TOKEN: string;
  CF_ZONE_ID: string;
}

export interface CacheHeaders {
  'Cache-Control': string;
  'CDN-Cache-Control'?: string;
  'Cloudflare-CDN-Cache-Control'?: string;
  'X-Cache-Status'?: string;
  'X-Cache-Key'?: string;
  'Age'?: string;
  'ETag'?: string;
  'Last-Modified'?: string;
}

export interface TransformOptions {
  width?: number;
  height?: number;
  quality?: number;
  format?: 'webp' | 'avif' | 'jpeg' | 'png';
  fit?: 'cover' | 'contain' | 'fill' | 'inside' | 'outside';
  sharpen?: number;
  blur?: number;
  rotate?: number;
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  reset: number;
}

export interface CacheMetadata {
  createdAt: number;
  expiresAt: number;
  contentType: string;
  contentLength: number;
  etag?: string;
  revalidateAfter?: number;
}

export interface MediaMetadata {
  originalSize: number;
  transformedSize: number;
  format: string;
  width?: number;
  height?: number;
  processingTime: number;
}

export interface AuthPayload {
  userId: string;
  tenantId: string;
  role: string;
  exp?: number;
  iat?: number;
  permissions?: string[];
}

export interface WorkerMetrics {
  requestId: string;
  timestamp: number;
  duration: number;
  status: number;
  cacheHit: boolean;
  bytesIn: number;
  bytesOut: number;
  region: string;
}