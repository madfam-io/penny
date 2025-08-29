#!/usr/bin/env node

/**
 * Fix workspace protocol for Vercel deployment
 * Replaces workspace:* with file: references or actual versions
 */

const fs = require('fs');
const path = require('path');

function fixWorkspaceProtocol() {
  console.log('Fixing workspace protocol for Vercel deployment...');
  
  // Read the main package.json to get workspace configuration
  const rootPackageJson = JSON.parse(
    fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8')
  );
  
  // Get all workspace directories
  const workspaceDirs = [];
  rootPackageJson.workspaces.forEach(pattern => {
    const baseDir = pattern.replace('/*', '');
    const fullPath = path.join(__dirname, '..', baseDir);
    
    if (fs.existsSync(fullPath)) {
      fs.readdirSync(fullPath).forEach(dir => {
        const pkgPath = path.join(fullPath, dir, 'package.json');
        if (fs.existsSync(pkgPath)) {
          workspaceDirs.push(path.join(baseDir, dir));
        }
      });
    }
  });
  
  // Create a map of package names to their paths
  const packageMap = {};
  workspaceDirs.forEach(dir => {
    const pkgPath = path.join(__dirname, '..', dir, 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    packageMap[pkg.name] = {
      path: dir,
      version: pkg.version || '0.0.1'
    };
  });
  
  // Fix workspace references in each package.json
  workspaceDirs.forEach(dir => {
    const pkgPath = path.join(__dirname, '..', dir, 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    let modified = false;
    
    // Fix dependencies
    ['dependencies', 'devDependencies', 'peerDependencies'].forEach(depType => {
      if (pkg[depType]) {
        Object.keys(pkg[depType]).forEach(depName => {
          if (pkg[depType][depName] === 'workspace:*' || pkg[depType][depName] === 'workspace:^') {
            // Replace with file reference for internal packages
            if (packageMap[depName]) {
              const relativePath = path.relative(dir, packageMap[depName].path);
              pkg[depType][depName] = `file:../../${packageMap[depName].path}`;
              modified = true;
              console.log(`  Fixed ${depName} in ${dir}/${depType}`);
            }
          }
        });
      }
    });
    
    // Write back if modified
    if (modified) {
      fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
    }
  });
  
  console.log('Workspace protocol fix complete!');
}

// Run the fix
fixWorkspaceProtocol();