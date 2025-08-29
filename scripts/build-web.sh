#!/bin/bash

# Build script for Vercel deployment
# This script builds the web app and its dependencies

echo "Building PENNY web application..."

# Build shared packages first
echo "Building shared packages..."
npm run build --workspace=@penny/shared --if-present
npm run build --workspace=@penny/ui --if-present
npm run build --workspace=@penny/api-client --if-present
npm run build --workspace=@penny/security --if-present

# Build the web app
echo "Building web application..."
cd apps/web
npm run build

echo "Build complete!"