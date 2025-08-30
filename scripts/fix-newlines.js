#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Function to fix newline characters in strings
function fixFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    const originalContent = content;
    
    // Fix split('\n') patterns
    content = content.replace(/split\('\\n'\)/g, "split('\\n')");
    
    // Fix regex patterns with newlines
    content = content.replace(/\/([^\/]+)\\n([^\/]+)\//g, '/$1\\n$2/');
    
    // Fix template literals with actual newlines
    content = content.replace(/`([^`]*)\n([^`]*)`/g, (match, p1, p2) => {
      // Check if this is a proper multiline template literal
      if (p1.includes('${') || p2.includes('${')) {
        return match; // Keep multiline template literals as is
      }
      // Otherwise fix single-line strings that got broken
      return `\`${p1}\\n${p2}\``;
    });
    
    // Fix broken string literals (string on next line)
    content = content.replace(/'([^']*)\n([^']*)'(?![a-zA-Z])/g, "'$1\\n$2'");
    content = content.replace(/"([^"]*)\n([^"]*)"/g, '"$1\\n$2"');
    
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
    'apps/web/src/**/*.{ts,tsx}',
    'apps/api/src/**/*.{ts,tsx}',
    'apps/admin/src/**/*.{ts,tsx}',
    'apps/sandbox/src/**/*.{ts,tsx}'
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