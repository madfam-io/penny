/**
 * Cloudflare Worker for Edge Authentication
 * Handles JWT validation at the edge for better performance
 */

import { Env } from './types';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          'Access-Control-Max-Age': '86400',
        },
      });
    }

    // Extract token from Authorization header
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.substring(7);

    try {
      // Verify JWT token
      const payload = await verifyJWT(token, env.JWT_PUBLIC_KEY);

      // Check token expiration
      if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
        return new Response(JSON.stringify({ error: 'Token expired' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Add user context to request headers
      const modifiedRequest = new Request(request);
      modifiedRequest.headers.set('X-User-Id', payload.userId);
      modifiedRequest.headers.set('X-Tenant-Id', payload.tenantId);
      modifiedRequest.headers.set('X-User-Role', payload.role);

      // Check rate limiting
      const rateLimitKey = `rate:${payload.userId}:${request.url}`;
      const rateLimit = await checkRateLimit(env.RATE_LIMITER, rateLimitKey);
      
      if (!rateLimit.allowed) {
        return new Response(JSON.stringify({ error: 'Rate limit exceeded' }), {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'X-RateLimit-Limit': rateLimit.limit.toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': rateLimit.reset.toString(),
          },
        });
      }

      // Forward to origin API
      const apiUrl = new URL(request.url);
      apiUrl.hostname = env.API_URL.replace('https://', '').replace('http://', '');
      
      const response = await fetch(apiUrl.toString(), {
        method: request.method,
        headers: modifiedRequest.headers,
        body: request.body,
      });

      // Add rate limit headers to response
      const modifiedResponse = new Response(response.body, response);
      modifiedResponse.headers.set('X-RateLimit-Limit', rateLimit.limit.toString());
      modifiedResponse.headers.set('X-RateLimit-Remaining', rateLimit.remaining.toString());
      modifiedResponse.headers.set('X-RateLimit-Reset', rateLimit.reset.toString());

      return modifiedResponse;
    } catch (error) {
      console.error('Auth error:', error);
      return new Response(JSON.stringify({ error: 'Authentication failed' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  },
};

async function verifyJWT(token: string, publicKey: string): Promise<any> {
  // Import the public key
  const key = await crypto.subtle.importKey(
    'spki',
    Buffer.from(publicKey, 'base64'),
    {
      name: 'RSASSA-PKCS1-v1_5',
      hash: 'SHA-256',
    },
    false,
    ['verify']
  );

  // Parse JWT
  const [headerB64, payloadB64, signatureB64] = token.split('.');
  
  // Decode payload
  const payload = JSON.parse(atob(payloadB64));
  
  // Verify signature
  const data = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
  const signature = Uint8Array.from(atob(signatureB64.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
  
  const valid = await crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5',
    key,
    signature,
    data
  );

  if (!valid) {
    throw new Error('Invalid signature');
  }

  return payload;
}

async function checkRateLimit(
  rateLimiter: DurableObjectNamespace,
  key: string
): Promise<{ allowed: boolean; limit: number; remaining: number; reset: number }> {
  const id = rateLimiter.idFromName(key);
  const stub = rateLimiter.get(id);
  
  const response = await stub.fetch('https://rate-limiter/check', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key, limit: 60, window: 60 }),
  });

  return response.json();
}

// Durable Object for rate limiting
export class RateLimiter {
  private state: DurableObjectState;
  private requests: Map<string, number[]> = new Map();

  constructor(state: DurableObjectState) {
    this.state = state;
  }

  async fetch(request: Request): Promise<Response> {
    const { key, limit, window } = await request.json();
    
    const now = Date.now();
    const windowStart = now - window * 1000;
    
    // Get existing requests for this key
    const keyRequests = this.requests.get(key) || [];
    
    // Filter out old requests
    const validRequests = keyRequests.filter(timestamp => timestamp > windowStart);
    
    // Check if limit exceeded
    if (validRequests.length >= limit) {
      return new Response(JSON.stringify({
        allowed: false,
        limit,
        remaining: 0,
        reset: Math.ceil((validRequests[0] + window * 1000) / 1000),
      }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    // Add current request
    validRequests.push(now);
    this.requests.set(key, validRequests);
    
    // Store state
    await this.state.storage.put(key, validRequests);
    
    return new Response(JSON.stringify({
      allowed: true,
      limit,
      remaining: limit - validRequests.length,
      reset: Math.ceil((now + window * 1000) / 1000),
    }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }
}