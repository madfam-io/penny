# Vercel Deployment Setup Guide

This guide covers deploying the PENNY frontend to Vercel.

## Prerequisites

1. Vercel account (Hobby plan is sufficient)
2. Railway backend services deployed
3. Domain configured (penny.onl)

## Deployment Architecture

```
penny.onl (Vercel) → Frontend React/Next.js app
api.penny.onl (Railway) → Backend API service  
ws.penny.onl (Railway) → WebSocket service
cdn.penny.onl (Cloudflare) → Static assets CDN
```

## Environment Variables

The following environment variables are configured in `vercel.json`:

```json
{
  "env": {
    "NEXT_PUBLIC_API_URL": "https://api.penny.onl",
    "NEXT_PUBLIC_WS_URL": "wss://ws.penny.onl",
    "NEXT_PUBLIC_CDN_URL": "https://cdn.penny.onl"
  }
}
```

## Deployment Steps

### 1. Initial Setup

```bash
# Install Vercel CLI
npm i -g vercel

# Login to Vercel
vercel login

# Link project
vercel link
```

### 2. Configure Project

When prompted:
- **Framework**: Vite
- **Build Command**: `npm run build --workspace=apps/web`
- **Output Directory**: `apps/web/dist`
- **Install Command**: `npm install`

### 3. Deploy

```bash
# Deploy to production
vercel --prod

# Deploy to preview
vercel
```

## Domain Configuration

### Set up subdomains in your DNS provider:

```
Type  Name    Value                   TTL
A     @       76.76.21.21            Auto  # Vercel
A     api     [Railway IP]           Auto  # Railway API
A     ws      [Railway IP]           Auto  # Railway WebSocket  
CNAME cdn     [Cloudflare endpoint]  Auto  # CDN
```

### Configure in Vercel Dashboard:

1. Go to Project Settings → Domains
2. Add `penny.onl`
3. Vercel will provide DNS records to configure

### Configure in Railway:

1. Go to each service settings
2. Add custom domains:
   - API service: `api.penny.onl`
   - WebSocket service: `ws.penny.onl`

## API Rewrites

The `vercel.json` includes rewrites to proxy API calls:

```json
{
  "rewrites": [
    {
      "source": "/api/:path*",
      "destination": "https://api.penny.onl/api/:path*"
    },
    {
      "source": "/ws/:path*",
      "destination": "https://ws.penny.onl/:path*"
    }
  ]
}
```

This allows the frontend to call `/api/*` and have it automatically routed to Railway.

## Troubleshooting

### Issue: Environment variable references secret error
**Solution**: We use direct URLs in `vercel.json` instead of secrets references.

### Issue: Multi-region deployment error
**Solution**: Single region (iad1) is configured for Hobby plan.

### Issue: Cron job error
**Solution**: Cron jobs removed from Vercel; they run on Railway.

### Issue: Build failures
**Check**:
- Node version matches (>=18.0.0)
- All dependencies installed
- Build command correct: `npm run build --workspace=apps/web`

### Issue: API calls failing
**Check**:
- Railway services are running
- Domains properly configured
- CORS headers configured in API

## Environment Files

For local development, use `.env.development`:
```env
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_WS_URL=ws://localhost:3003
NEXT_PUBLIC_CDN_URL=http://localhost:3004
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

For production, use `.env.production`:
```env
NEXT_PUBLIC_API_URL=https://api.penny.onl
NEXT_PUBLIC_WS_URL=wss://ws.penny.onl
NEXT_PUBLIC_CDN_URL=https://cdn.penny.onl
NEXT_PUBLIC_APP_URL=https://penny.onl
```

## Monitoring

- **Vercel Dashboard**: Monitor builds, deployments, and function logs
- **Railway Dashboard**: Monitor backend services
- **Cloudflare Dashboard**: Monitor CDN performance

## Security Headers

Security headers are configured in `vercel.json`:
- X-Content-Type-Options: nosniff
- X-Frame-Options: DENY
- X-XSS-Protection: 1; mode=block

## Support

For deployment issues:
1. Check Vercel build logs
2. Verify environment variables
3. Ensure Railway services are running
4. Check domain DNS configuration