#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Function to fix escaped characters in a file
function fixFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Check if file needs fixing (has escaped characters)
    if (content.includes('\\n') || content.includes('\\"') || content.includes("\\'")) {
      const originalContent = content;
      
      // Replace escaped newlines with actual newlines
      content = content.replace(/\\n/g, '\n');
      
      // Replace escaped quotes
      content = content.replace(/\\"/g, '"');
      content = content.replace(/\\'/g, "'");
      
      // Replace escaped backslashes (but not before n, t, r, etc)
      content = content.replace(/\\\\(?![ntr])/g, '\\');
      
      // Replace escaped tabs
      content = content.replace(/\\t/g, '\t');
      
      if (content !== originalContent) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`Fixed: ${filePath}`);
        return true;
      }
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