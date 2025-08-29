#!/usr/bin/env node

/**
 * Vercel setup script
 * Prepares the repository for Vercel deployment
 */

const fs = require('fs');
const path = require('path');

console.log('Preparing for Vercel deployment...');

// Path to web app
const webAppPath = path.join(__dirname, '..', 'apps', 'web');
const packageJsonPath = path.join(webAppPath, 'package.json');
const vercelPackageJsonPath = path.join(webAppPath, 'package.vercel.json');

// Copy Vercel-specific package.json if it exists
if (fs.existsSync(vercelPackageJsonPath)) {
  console.log('Using Vercel-specific package.json...');
  const vercelPackage = fs.readFileSync(vercelPackageJsonPath, 'utf8');
  fs.writeFileSync(packageJsonPath, vercelPackage);
  console.log('✓ Copied package.vercel.json to package.json');
} else {
  console.log('No package.vercel.json found, using existing package.json');
}

// Remove workspace configuration from root package.json
const rootPackagePath = path.join(__dirname, '..', 'package.json');
if (fs.existsSync(rootPackagePath)) {
  console.log('Removing workspace configuration from root...');
  const rootPackage = JSON.parse(fs.readFileSync(rootPackagePath, 'utf8'));
  delete rootPackage.workspaces;
  fs.writeFileSync(rootPackagePath, JSON.stringify(rootPackage, null, 2));
  console.log('✓ Removed workspace configuration');
}

console.log('✅ Vercel setup complete!');
process.exit(0);