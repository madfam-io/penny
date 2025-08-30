#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Function to fix all escaped characters comprehensively
function fixFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    const originalContent = content;
    
    // Fix concatenated imports with \n
    content = content.replace(/^(import .+);\\n(import .+)/gm, '$1;\n$2');
    content = content.replace(/\\nimport /g, '\nimport ');
    content = content.replace(/\\nexport /g, '\nexport ');
    
    // Fix JSX with literal \n characters
    content = content.replace(/<Route \\n/g, '<Route\n');
    content = content.replace(/ \\n /g, '\n');
    
    // Fix other common patterns
    content = content.replace(/className="(.+?)\\n(.+?)"/g, 'className="$1\n$2"');
    content = content.replace(/\{\/\* (.+?) \*\/\}\\n/g, '{/* $1 */}\n');
    
    // Fix concatenated statements
    content = content.replace(/;\\n/g, ';\n');
    content = content.replace(/\}\\n/g, '}\n');
    content = content.replace(/\{\\n/g, '{\n');
    content = content.replace(/\)\\n/g, ')\n');
    
    // Fix string literals with escaped quotes
    content = content.replace(/\\"/g, '"');
    content = content.replace(/\\'/g, "'");
    
    // Fix template literals
    content = content.replace(/`([^`]*?)\\n([^`]*?)`/g, '`$1\n$2`');
    
    if (content !== originalContent) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`Fixed: ${filePath}`);
      return true;
    }
    return false;
  } catch (error) {
    console.error(`Error processing ${filePath}:`, error.message);
    return false;
  }
}

// Main function
async function main() {
  const patterns = [
    'apps/web/src/**/*.{ts,tsx,js,jsx}',
    'apps/api/src/**/*.{ts,tsx,js,jsx}',
    'apps/admin/src/**/*.{ts,tsx,js,jsx}',
    'apps/sandbox/src/**/*.{ts,tsx,js,jsx}',
    'packages/*/src/**/*.{ts,tsx,js,jsx}'
  ];
  
  let fixedCount = 0;
  let totalCount = 0;
  
  for (const pattern of patterns) {
    const files = glob.sync(pattern, { 
      ignore: ['**/node_modules/**', '**/dist/**', '**/build/**']
    });
    
    for (const file of files) {
      totalCount++;
      if (fixFile(file)) {
        fixedCount++;
      }
    }
  }
  
  console.log(`\nProcessed ${totalCount} files, fixed ${fixedCount} files.`);
}

// Run the script
main().catch(console.error);