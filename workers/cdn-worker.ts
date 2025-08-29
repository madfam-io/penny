/**
 * Cloudflare CDN Worker
 * Handles edge caching, static asset serving, and R2 bucket access
 */

import { Env, CacheHeaders, CacheMetadata } from './types';

const CACHE_TTL = {
  STATIC: 31536000, // 1 year for immutable assets
  ARTIFACT: 86400,  // 1 day for artifacts
  PREVIEW: 300,      // 5 minutes for previews
  ERROR: 60,         // 1 minute for errors
};

const MIME_TYPES: Record<string, string> = {
  // Documents
  'pdf': 'application/pdf',
  'doc': 'application/msword',
  'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  
  // Images
  'jpg': 'image/jpeg',
  'jpeg': 'image/jpeg',
  'png': 'image/png',
  'gif': 'image/gif',
  'webp': 'image/webp',
  'avif': 'image/avif',
  'svg': 'image/svg+xml',
  
  // Code
  'js': 'application/javascript',
  'mjs': 'application/javascript',
  'ts': 'application/typescript',
  'jsx': 'text/jsx',
  'tsx': 'text/tsx',
  'css': 'text/css',
  'html': 'text/html',
  'json': 'application/json',
  
  // Data
  'csv': 'text/csv',
  'xml': 'application/xml',
  'yaml': 'text/yaml',
  'yml': 'text/yaml',
  
  // Archives
  'zip': 'application/zip',
  'tar': 'application/x-tar',
  'gz': 'application/gzip',
};

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname.slice(1); // Remove leading slash
    
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return handleCors();
    }
    
    // Only allow GET and HEAD requests for CDN
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response('Method not allowed', { status: 405 });
    }
    
    // Determine bucket based on path
    const bucket = determineBucket(path, env);
    if (!bucket) {
      return new Response('Not found', { status: 404 });
    }
    
    // Extract object key from path
    const objectKey = extractObjectKey(path);
    
    // Check edge cache first
    const cacheKey = new Request(url.toString(), request);
    const cache = caches.default;
    
    let response = await cache.match(cacheKey);
    
    if (response) {
      // Cache hit - add cache status header
      response = new Response(response.body, response);
      response.headers.set('X-Cache-Status', 'HIT');
      response.headers.set('Age', calculateAge(response.headers.get('Date')));
      return response;
    }
    
    // Cache miss - fetch from R2
    try {
      const object = await bucket.get(objectKey);
      
      if (!object) {
        // Object not found in R2
        const errorResponse = new Response('Not found', { 
          status: 404,
          headers: getCacheHeaders('error')
        });
        
        // Cache 404s briefly to prevent hammering R2
        ctx.waitUntil(cache.put(cacheKey, errorResponse.clone()));
        return errorResponse;
      }
      
      // Determine content type
      const ext = objectKey.split('.').pop()?.toLowerCase() || '';
      const contentType = object.httpMetadata?.contentType || 
                         MIME_TYPES[ext] || 
                         'application/octet-stream';
      
      // Build response headers
      const headers: HeadersInit = {
        'Content-Type': contentType,
        'Content-Length': object.size.toString(),
        'ETag': object.httpEtag || object.etag,
        'Last-Modified': object.uploaded.toUTCString(),
        'X-Cache-Status': 'MISS',
        ...getCacheHeaders(determineCacheType(path)),
        ...getCorsHeaders(),
      };
      
      // Add custom metadata if available
      if (object.customMetadata) {
        Object.entries(object.customMetadata).forEach(([key, value]) => {
          headers[`X-Metadata-${key}`] = value;
        });
      }
      
      // Handle conditional requests
      const ifNoneMatch = request.headers.get('If-None-Match');
      const ifModifiedSince = request.headers.get('If-Modified-Since');
      
      if (ifNoneMatch && ifNoneMatch === headers['ETag']) {
        return new Response(null, { status: 304, headers });
      }
      
      if (ifModifiedSince && new Date(ifModifiedSince) >= object.uploaded) {
        return new Response(null, { status: 304, headers });
      }
      
      // Create response
      response = new Response(object.body, {
        status: 200,
        headers,
      });
      
      // Cache the response
      ctx.waitUntil(cache.put(cacheKey, response.clone()));
      
      // Log metrics
      ctx.waitUntil(logMetrics(env, {
        path,
        size: object.size,
        cacheStatus: 'MISS',
        contentType,
      }));
      
      return response;
    } catch (error) {
      console.error('CDN error:', error);
      
      const errorResponse = new Response('Internal server error', {
        status: 500,
        headers: {
          'X-Cache-Status': 'ERROR',
          ...getCacheHeaders('error'),
        },
      });
      
      // Cache errors briefly
      ctx.waitUntil(cache.put(cacheKey, errorResponse.clone()));
      return errorResponse;
    }
  },
};

function determineBucket(path: string, env: Env): R2Bucket | null {
  if (path.startsWith('artifacts/')) return env.ARTIFACTS;
  if (path.startsWith('uploads/')) return env.UPLOADS;
  if (path.startsWith('exports/')) return env.EXPORTS;
  if (path.startsWith('static/')) return env.ARTIFACTS; // Static assets in artifacts bucket
  return null;
}

function extractObjectKey(path: string): string {
  // Remove bucket prefix from path
  const prefixes = ['artifacts/', 'uploads/', 'exports/', 'static/'];
  for (const prefix of prefixes) {
    if (path.startsWith(prefix)) {
      return path.slice(prefix.length);
    }
  }
  return path;
}

function determineCacheType(path: string): 'static' | 'artifact' | 'preview' {
  if (path.startsWith('static/') || path.includes('/assets/')) return 'static';
  if (path.includes('/preview/') || path.includes('/thumb/')) return 'preview';
  return 'artifact';
}

function getCacheHeaders(type: 'static' | 'artifact' | 'preview' | 'error'): CacheHeaders {
  const ttl = CACHE_TTL[type.toUpperCase() as keyof typeof CACHE_TTL];
  
  return {
    'Cache-Control': `public, max-age=${ttl}`,
    'CDN-Cache-Control': `max-age=${ttl}`,
    'Cloudflare-CDN-Cache-Control': `max-age=${ttl}`,
  };
}

function getCorsHeaders(): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Range, If-None-Match, If-Modified-Since',
    'Access-Control-Expose-Headers': 'Content-Length, Content-Range, ETag, Last-Modified',
    'Access-Control-Max-Age': '86400',
  };
}

function handleCors(): Response {
  return new Response(null, {
    status: 200,
    headers: getCorsHeaders(),
  });
}

function calculateAge(dateHeader: string | null): string {
  if (!dateHeader) return '0';
  
  const age = Math.floor((Date.now() - new Date(dateHeader).getTime()) / 1000);
  return age.toString();
}

async function logMetrics(env: Env, metrics: any): Promise<void> {
  // Store metrics in KV for aggregation
  const key = `metrics:${new Date().toISOString().slice(0, 10)}`;
  const existing = await env.CACHE.get(key, 'json') || { requests: 0, bytes: 0 };
  
  await env.CACHE.put(key, JSON.stringify({
    requests: existing.requests + 1,
    bytes: existing.bytes + (metrics.size || 0),
    lastUpdated: Date.now(),
  }), {
    expirationTtl: 86400 * 7, // Keep metrics for 7 days
  });
}

// Purge cache endpoint (requires authentication)
export async function handlePurge(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const path = url.searchParams.get('path');
  
  if (!path) {
    return new Response('Missing path parameter', { status: 400 });
  }
  
  // Verify authentication (simplified - should check JWT)
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return new Response('Unauthorized', { status: 401 });
  }
  
  // Purge from cache
  const cache = caches.default;
  const purgeUrl = `https://${url.hostname}/${path}`;
  const success = await cache.delete(purgeUrl);
  
  return new Response(JSON.stringify({ 
    success, 
    path,
    message: success ? 'Cache purged' : 'Not found in cache'
  }), {
    headers: { 'Content-Type': 'application/json' },
  });
}