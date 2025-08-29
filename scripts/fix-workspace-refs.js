#!/usr/bin/env node

/**
 * Fix workspace:* references for Vercel deployment
 * Replaces workspace:* with actual version numbers
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Map of internal packages and their versions
const internalPackages = {
  '@penny/core': '0.0.1',
  '@penny/database': '0.0.1',
  '@penny/ui': '0.0.1',
  '@penny/api-client': '0.0.1',
  '@penny/security': '0.0.1',
  '@penny/analytics': '0.0.1',
  '@penny/billing': '0.0.1',
  '@penny/telemetry': '0.0.1',
  '@penny/tools': '0.0.1'
};

function fixPackageJson(filePath) {
  const pkg = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  let modified = false;
  
  // Fix dependencies
  ['dependencies', 'devDependencies', 'peerDependencies'].forEach(depType => {
    if (pkg[depType]) {
      Object.keys(pkg[depType]).forEach(depName => {
        if (pkg[depType][depName] === 'workspace:*' || pkg[depType][depName] === 'workspace:^') {
          if (internalPackages[depName]) {
            pkg[depType][depName] = internalPackages[depName];
            modified = true;
            console.log(`  Fixed ${depName} in ${path.basename(path.dirname(filePath))}/${depType}`);
          }
        }
      });
    }
  });
  
  if (modified) {
    fs.writeFileSync(filePath, JSON.stringify(pkg, null, 2) + '\n');
  }
  
  return modified;
}

console.log('Fixing workspace:* references for Vercel...\n');

// Get all package.json files
const packageFiles = execSync('find . -name package.json -not -path "*/node_modules/*" -not -path "*/.next/*" -not -path "*/dist/*"', { encoding: 'utf8' })
  .trim()
  .split('\n')
  .filter(Boolean);

let fixedCount = 0;
packageFiles.forEach(file => {
  const fullPath = path.resolve(file);
  if (fixPackageJson(fullPath)) {
    fixedCount++;
  }
});

console.log(`\n✅ Fixed ${fixedCount} package.json files`);