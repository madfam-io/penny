#!/usr/bin/env node

/**
 * Fix ALL workspace:* references for Vercel deployment
 * This script runs during Vercel build to replace workspace protocol
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function fixPackageJson(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const pkg = JSON.parse(content);
  let modified = false;
  
  // Fix all dependency types
  ['dependencies', 'devDependencies', 'peerDependencies'].forEach(depType => {
    if (pkg[depType]) {
      Object.keys(pkg[depType]).forEach(depName => {
        const depValue = pkg[depType][depName];
        if (depValue === 'workspace:*' || depValue === 'workspace:^' || depValue.startsWith('workspace:')) {
          // Replace any workspace reference with a version
          pkg[depType][depName] = '0.0.1';
          modified = true;
          console.log(`  Fixed ${depName}: ${depValue} → 0.0.1 in ${path.basename(path.dirname(filePath))}/${depType}`);
        }
      });
    }
  });
  
  if (modified) {
    fs.writeFileSync(filePath, JSON.stringify(pkg, null, 2) + '\n');
  }
  
  return modified;
}

console.log('Fixing ALL workspace:* references for Vercel...\n');

// Get all package.json files
const files = execSync('find . -name package.json -not -path "*/node_modules/*" -not -path "*/.next/*" -not -path "*/dist/*" 2>/dev/null || true', { 
  encoding: 'utf8',
  cwd: process.cwd()
}).trim().split('\n').filter(Boolean);

console.log(`Found ${files.length} package.json files to check\n`);

let fixedCount = 0;
files.forEach(file => {
  try {
    const fullPath = path.resolve(file);
    if (fs.existsSync(fullPath)) {
      if (fixPackageJson(fullPath)) {
        fixedCount++;
      }
    }
  } catch (err) {
    console.error(`Error processing ${file}: ${err.message}`);
  }
});

console.log(`\n✅ Fixed ${fixedCount} package.json files`);

// Don't remove workspaces - Turbo needs it for resolution
// Just ensure packageManager is set
const rootPkg = path.join(process.cwd(), 'package.json');
if (fs.existsSync(rootPkg)) {
  const pkg = JSON.parse(fs.readFileSync(rootPkg, 'utf8'));
  if (!pkg.packageManager) {
    console.log('\nAdding packageManager to root package.json...');
    pkg.packageManager = 'npm@10.8.2';
    fs.writeFileSync(rootPkg, JSON.stringify(pkg, null, 2) + '\n');
  }
}