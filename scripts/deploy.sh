#!/bin/bash

# PENNY Platform Deployment Script
# Deploys to Vercel, Railway, and Cloudflare

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[DEPLOY]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Check required tools
check_requirements() {
    print_status "Checking requirements..."
    
    command -v vercel >/dev/null 2>&1 || { print_error "Vercel CLI not installed. Run: npm i -g vercel"; exit 1; }
    command -v railway >/dev/null 2>&1 || { print_error "Railway CLI not installed. Run: npm i -g @railway/cli"; exit 1; }
    command -v wrangler >/dev/null 2>&1 || { print_error "Wrangler not installed. Run: npm i -g wrangler"; exit 1; }
    
    print_status "All requirements met!"
}

# Deploy to Vercel
deploy_vercel() {
    print_status "Deploying frontend to Vercel..."
    
    # Deploy web app
    print_status "Deploying web application..."
    cd apps/web
    vercel --prod --yes
    cd ../..
    
    # Deploy admin console
    print_status "Deploying admin console..."
    cd apps/admin
    vercel --prod --yes
    cd ../..
    
    print_status "Vercel deployment complete!"
}

# Deploy to Railway
deploy_railway() {
    print_status "Deploying backend to Railway..."
    
    # Deploy all services
    railway up --detach
    
    # Run database migrations
    print_status "Running database migrations..."
    railway run --service postgres npm run db:migrate
    
    # Check service health
    print_status "Checking service health..."
    sleep 10
    railway status
    
    print_status "Railway deployment complete!"
}

# Deploy to Cloudflare
deploy_cloudflare() {
    print_status "Deploying to Cloudflare..."
    
    # Deploy Workers
    print_status "Deploying edge workers..."
    wrangler deploy workers/auth-worker.ts
    wrangler deploy workers/cdn-worker.ts
    wrangler deploy workers/media-transform.ts
    
    # Create R2 buckets if they don't exist
    print_status "Setting up R2 buckets..."
    wrangler r2 bucket create penny-artifacts || true
    wrangler r2 bucket create penny-uploads || true
    wrangler r2 bucket create penny-exports || true
    
    # Upload static assets to R2
    if [ -d "dist/assets" ]; then
        print_status "Uploading static assets to R2..."
        wrangler r2 object put penny-artifacts/static/ --file=dist/assets/
    fi
    
    print_status "Cloudflare deployment complete!"
}

# Update environment variables
update_env() {
    print_status "Updating environment variables..."
    
    # Get URLs from deployments
    VERCEL_URL=$(vercel ls --json | jq -r '.[0].url')
    RAILWAY_URL=$(railway status --json | jq -r '.services.api.url')
    
    # Update Vercel environment variables
    vercel env pull
    vercel env add NEXT_PUBLIC_API_URL "$RAILWAY_URL" production
    vercel env add NEXT_PUBLIC_WS_URL "wss://${RAILWAY_URL}" production
    
    print_status "Environment variables updated!"
}

# Run smoke tests
run_tests() {
    print_status "Running smoke tests..."
    
    # Test frontend
    curl -s -o /dev/null -w "%{http_code}" https://app.penny.ai | grep -q "200" || print_warning "Frontend not responding"
    
    # Test API health
    curl -s -o /dev/null -w "%{http_code}" https://api.penny.ai/health | grep -q "200" || print_warning "API not healthy"
    
    # Test WebSocket
    echo "Testing WebSocket connection..."
    node -e "
        const ws = require('ws');
        const client = new ws('wss://ws.penny.ai');
        client.on('open', () => { console.log('WebSocket OK'); process.exit(0); });
        client.on('error', () => { console.log('WebSocket FAILED'); process.exit(1); });
    " || print_warning "WebSocket not responding"
    
    print_status "Smoke tests complete!"
}

# Main deployment flow
main() {
    print_status "Starting PENNY platform deployment..."
    
    # Parse arguments
    DEPLOY_ALL=true
    DEPLOY_VERCEL=false
    DEPLOY_RAILWAY=false
    DEPLOY_CLOUDFLARE=false
    
    while [[ $# -gt 0 ]]; do
        case $1 in
            --vercel)
                DEPLOY_VERCEL=true
                DEPLOY_ALL=false
                shift
                ;;
            --railway)
                DEPLOY_RAILWAY=true
                DEPLOY_ALL=false
                shift
                ;;
            --cloudflare)
                DEPLOY_CLOUDFLARE=true
                DEPLOY_ALL=false
                shift
                ;;
            --help)
                echo "Usage: $0 [options]"
                echo "Options:"
                echo "  --vercel      Deploy only to Vercel"
                echo "  --railway     Deploy only to Railway"
                echo "  --cloudflare  Deploy only to Cloudflare"
                echo "  --help        Show this help message"
                exit 0
                ;;
            *)
                print_error "Unknown option: $1"
                exit 1
                ;;
        esac
    done
    
    # Check requirements
    check_requirements
    
    # Build the project
    print_status "Building project..."
    npm run build
    
    # Deploy to platforms
    if [ "$DEPLOY_ALL" = true ] || [ "$DEPLOY_VERCEL" = true ]; then
        deploy_vercel
    fi
    
    if [ "$DEPLOY_ALL" = true ] || [ "$DEPLOY_RAILWAY" = true ]; then
        deploy_railway
    fi
    
    if [ "$DEPLOY_ALL" = true ] || [ "$DEPLOY_CLOUDFLARE" = true ]; then
        deploy_cloudflare
    fi
    
    # Update environment variables
    if [ "$DEPLOY_ALL" = true ]; then
        update_env
        run_tests
    fi
    
    print_status "🚀 Deployment complete!"
    print_status "Frontend: https://app.penny.ai"
    print_status "Admin: https://admin.penny.ai"
    print_status "API: https://api.penny.ai"
    print_status "CDN: https://cdn.penny.ai"
}

# Run main function
main "$@"