/**
 * Cloudflare Media Transform Worker
 * Handles image optimization, resizing, and format conversion
 */

import { Env, TransformOptions, MediaMetadata } from './types';

const MAX_IMAGE_SIZE = 20 * 1024 * 1024; // 20MB
const SUPPORTED_FORMATS = ['jpeg', 'jpg', 'png', 'webp', 'avif', 'gif', 'svg'];

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return handleCors();
    }
    
    // Only allow GET requests for transformations
    if (request.method !== 'GET') {
      return new Response('Method not allowed', { status: 405 });
    }
    
    try {
      // Parse transformation parameters from URL
      const options = parseTransformOptions(url.searchParams);
      const sourcePath = url.pathname.slice(1); // Remove leading slash
      
      // Validate source path
      if (!sourcePath) {
        return new Response('Missing source path', { status: 400 });
      }
      
      // Generate cache key based on source and options
      const cacheKey = generateCacheKey(url.toString(), options);
      const cache = caches.default;
      
      // Check cache first
      let response = await cache.match(cacheKey);
      if (response) {
        response = new Response(response.body, response);
        response.headers.set('X-Transform-Cache', 'HIT');
        return response;
      }
      
      // Determine source bucket
      const bucket = determineBucket(sourcePath, env);
      if (!bucket) {
        return new Response('Invalid source path', { status: 400 });
      }
      
      // Extract object key
      const objectKey = extractObjectKey(sourcePath);
      
      // Fetch original image from R2
      const original = await bucket.get(objectKey);
      if (!original) {
        return new Response('Image not found', { status: 404 });
      }
      
      // Check file size
      if (original.size > MAX_IMAGE_SIZE) {
        return new Response('Image too large', { status: 413 });
      }
      
      // Get original format
      const originalFormat = getImageFormat(objectKey, original.httpMetadata?.contentType);
      if (!originalFormat || !SUPPORTED_FORMATS.includes(originalFormat)) {
        return new Response('Unsupported image format', { status: 415 });
      }
      
      // Apply transformations
      const startTime = Date.now();
      const transformed = await transformImage(original, options, originalFormat);
      const processingTime = Date.now() - startTime;
      
      // Build response headers
      const headers: HeadersInit = {
        'Content-Type': `image/${options.format || originalFormat}`,
        'Cache-Control': 'public, max-age=31536000, immutable',
        'X-Transform-Cache': 'MISS',
        'X-Transform-Time': `${processingTime}ms`,
        'X-Original-Size': original.size.toString(),
        'X-Transformed-Size': transformed.byteLength.toString(),
        ...getCorsHeaders(),
      };
      
      // Add transformation parameters to headers
      if (options.width) headers['X-Transform-Width'] = options.width.toString();
      if (options.height) headers['X-Transform-Height'] = options.height.toString();
      if (options.quality) headers['X-Transform-Quality'] = options.quality.toString();
      if (options.format) headers['X-Transform-Format'] = options.format;
      
      // Create response
      response = new Response(transformed, {
        status: 200,
        headers,
      });
      
      // Cache the transformed image
      ctx.waitUntil(cache.put(cacheKey, response.clone()));
      
      // Log metrics
      ctx.waitUntil(logMetrics(env, {
        path: sourcePath,
        originalSize: original.size,
        transformedSize: transformed.byteLength,
        format: options.format || originalFormat,
        processingTime,
        options,
      }));
      
      // Optionally store transformed image back to R2
      if (shouldStoreTransform(options)) {
        const transformedKey = generateTransformedKey(objectKey, options);
        ctx.waitUntil(
          bucket.put(transformedKey, transformed, {
            httpMetadata: {
              contentType: `image/${options.format || originalFormat}`,
            },
            customMetadata: {
              originalKey: objectKey,
              transform: JSON.stringify(options),
              processingTime: processingTime.toString(),
            },
          })
        );
      }
      
      return response;
    } catch (error) {
      console.error('Transform error:', error);
      return new Response('Transform failed', { 
        status: 500,
        headers: { 'X-Error': error.message },
      });
    }
  },
};

async function transformImage(
  original: R2ObjectBody,
  options: TransformOptions,
  originalFormat: string
): Promise<ArrayBuffer> {
  // For SVG, return as-is (vector format)
  if (originalFormat === 'svg') {
    return await original.arrayBuffer();
  }
  
  // Use Cloudflare Image Resizing API
  const imageRequest = new Request('https://transform.internal', {
    method: 'POST',
    headers: {
      'Content-Type': `image/${originalFormat}`,
    },
    body: original.body,
    // @ts-ignore - Cloudflare-specific API
    cf: {
      image: {
        width: options.width,
        height: options.height,
        quality: options.quality || 85,
        format: options.format || 'auto',
        fit: options.fit || 'contain',
        sharpen: options.sharpen,
        blur: options.blur,
        rotate: options.rotate,
        background: '#FFFFFF',
        trim: false,
        compress: true,
        progressive: true,
        metadata: 'none', // Strip metadata for smaller files
        onerror: 'redirect',
      },
    },
  });
  
  // Process the image
  const response = await fetch(imageRequest);
  
  if (!response.ok) {
    // Fallback: return original if transformation fails
    console.warn('Transform failed, returning original');
    return await original.arrayBuffer();
  }
  
  return await response.arrayBuffer();
}

function parseTransformOptions(params: URLSearchParams): TransformOptions {
  const options: TransformOptions = {};
  
  // Dimensions
  const width = params.get('w') || params.get('width');
  const height = params.get('h') || params.get('height');
  if (width) options.width = Math.min(4096, Math.max(1, parseInt(width)));
  if (height) options.height = Math.min(4096, Math.max(1, parseInt(height)));
  
  // Quality (1-100)
  const quality = params.get('q') || params.get('quality');
  if (quality) options.quality = Math.min(100, Math.max(1, parseInt(quality)));
  
  // Format
  const format = params.get('f') || params.get('format');
  if (format && ['webp', 'avif', 'jpeg', 'png'].includes(format)) {
    options.format = format as TransformOptions['format'];
  }
  
  // Fit mode
  const fit = params.get('fit');
  if (fit && ['cover', 'contain', 'fill', 'inside', 'outside'].includes(fit)) {
    options.fit = fit as TransformOptions['fit'];
  }
  
  // Effects
  const sharpen = params.get('sharpen');
  if (sharpen) options.sharpen = Math.min(10, Math.max(0, parseFloat(sharpen)));
  
  const blur = params.get('blur');
  if (blur) options.blur = Math.min(250, Math.max(0, parseInt(blur)));
  
  const rotate = params.get('rotate');
  if (rotate) options.rotate = parseInt(rotate) % 360;
  
  return options;
}

function generateCacheKey(url: string, options: TransformOptions): Request {
  // Normalize URL and options for consistent cache keys
  const normalized = new URL(url);
  normalized.searchParams.sort();
  return new Request(normalized.toString());
}

function generateTransformedKey(originalKey: string, options: TransformOptions): string {
  const parts = originalKey.split('.');
  const ext = parts.pop();
  const base = parts.join('.');
  
  // Build suffix from options
  const suffix = [
    options.width && `w${options.width}`,
    options.height && `h${options.height}`,
    options.quality && `q${options.quality}`,
    options.format && `f${options.format}`,
  ].filter(Boolean).join('_');
  
  const newExt = options.format || ext;
  return `${base}_${suffix}.${newExt}`;
}

function determineBucket(path: string, env: Env): R2Bucket | null {
  if (path.startsWith('uploads/')) return env.UPLOADS;
  if (path.startsWith('artifacts/')) return env.ARTIFACTS;
  return null;
}

function extractObjectKey(path: string): string {
  const prefixes = ['uploads/', 'artifacts/'];
  for (const prefix of prefixes) {
    if (path.startsWith(prefix)) {
      return path.slice(prefix.length);
    }
  }
  return path;
}

function getImageFormat(filename: string, contentType?: string): string | null {
  // Try to get format from content type
  if (contentType) {
    const match = contentType.match(/image\/(\w+)/);
    if (match) return match[1].toLowerCase();
  }
  
  // Fall back to file extension
  const ext = filename.split('.').pop()?.toLowerCase();
  return ext && SUPPORTED_FORMATS.includes(ext) ? ext : null;
}

function shouldStoreTransform(options: TransformOptions): boolean {
  // Store commonly requested transformations
  // Thumbnails and standard sizes
  const commonSizes = [
    { width: 150, height: 150 },  // Thumbnail
    { width: 300, height: 300 },  // Small
    { width: 800, height: 600 },  // Medium
    { width: 1920, height: 1080 }, // Full HD
  ];
  
  return commonSizes.some(size => 
    size.width === options.width && size.height === options.height
  );
}

function getCorsHeaders(): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  };
}

function handleCors(): Response {
  return new Response(null, {
    status: 200,
    headers: getCorsHeaders(),
  });
}

async function logMetrics(env: Env, metrics: any): Promise<void> {
  const key = `transform:${new Date().toISOString().slice(0, 10)}`;
  const existing = await env.CACHE.get(key, 'json') || { 
    count: 0, 
    totalOriginal: 0, 
    totalTransformed: 0,
    totalTime: 0,
  };
  
  await env.CACHE.put(key, JSON.stringify({
    count: existing.count + 1,
    totalOriginal: existing.totalOriginal + metrics.originalSize,
    totalTransformed: existing.totalTransformed + metrics.transformedSize,
    totalTime: existing.totalTime + metrics.processingTime,
    avgCompressionRatio: (
      (existing.totalTransformed + metrics.transformedSize) / 
      (existing.totalOriginal + metrics.originalSize)
    ).toFixed(2),
    avgProcessingTime: Math.round(
      (existing.totalTime + metrics.processingTime) / (existing.count + 1)
    ),
    lastUpdated: Date.now(),
  }), {
    expirationTtl: 86400 * 7, // Keep metrics for 7 days
  });
}