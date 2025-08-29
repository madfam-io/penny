#!/bin/bash

# Vercel pre-build script
# This script prepares the environment for Vercel deployment

echo "Preparing for Vercel deployment..."

# Copy the Vercel-specific package.json
if [ -f "apps/web/package.vercel.json" ]; then
  echo "Using Vercel-specific package.json..."
  cp apps/web/package.vercel.json apps/web/package.json
fi

# Remove workspace references from root package.json temporarily
echo "Removing workspace configuration..."
node -e "
const fs = require('fs');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
delete pkg.workspaces;
fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2));
"

echo "Pre-build preparation complete!"