/**
 * Cloudflare Workers Entry Point
 * Routes requests to appropriate worker based on path
 */

import authWorker from './auth-worker';
import cdnWorker from './cdn-worker';
import mediaTransform from './media-transform';
import { Env } from './types';

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    
    // Route to appropriate worker based on path
    if (path.startsWith('/auth/') || path.startsWith('/api/')) {
      // Authentication and API proxy
      return authWorker.fetch(request, env, ctx);
    } else if (path.startsWith('/media/') || url.searchParams.has('transform')) {
      // Media transformation
      return mediaTransform.fetch(request, env, ctx);
    } else if (
      path.startsWith('/static/') ||
      path.startsWith('/artifacts/') ||
      path.startsWith('/uploads/') ||
      path.startsWith('/exports/')
    ) {
      // CDN and static assets
      return cdnWorker.fetch(request, env, ctx);
    }
    
    // Default: serve from CDN
    return cdnWorker.fetch(request, env, ctx);
  },
};

// Export individual workers for specific routes
export { authWorker, cdnWorker, mediaTransform };

// Export Durable Objects
export { RateLimiter } from './auth-worker';