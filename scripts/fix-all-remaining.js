#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Function to fix all remaining escaped characters
function fixFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    const originalContent = content;
    
    // Fix literal backslash-n sequences
    content = content.replace(/\\n/g, '\n');
    
    // Fix literal backslash-quote sequences
    content = content.replace(/\\"/g, '"');
    content = content.replace(/\\'/g, "'");
    
    // Fix literal backslash-t sequences
    content = content.replace(/\\t/g, '\t');
    
    // Fix JSX indentation - lines starting without proper indent after JSX tags
    content = content.replace(/^(<[^/>]+>)$/gm, (match) => {
      return match;
    });
    
    // Fix orphaned JSX content (content at start of line that should be indented)
    content = content.replace(/^(<\w+\s)/gm, (match, p1, offset, string) => {
      // Look at previous line to determine indentation
      const lines = string.substring(0, offset).split('\n');
      const prevLine = lines[lines.length - 1] || '';
      const prevIndent = prevLine.match(/^(\s*)/)?.[1] || '';
      
      // If this looks like it should be indented more
      if (prevLine.trim().endsWith('>') || prevLine.trim().endsWith('{')) {
        return '  ' + prevIndent + match;
      }
      return match;
    });
    
    // Fix case statements with escaped newlines
    content = content.replace(/case\s+'([^']+)':\s*\\n\s*return/g, "case '$1':\n        return");
    content = content.replace(/default:\s*\\n\s*return/g, "default:\n        return");
    
    // Clean up any double escapes
    content = content.replace(/\\\\/g, '\\');
    
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
  // Get all TypeScript/TSX files
  const allFiles = glob.sync('apps/web/src/**/*.{ts,tsx}', {
    ignore: ['**/node_modules/**', '**/dist/**', '**/build/**']
  });
  
  let fixedCount = 0;
  let totalCount = 0;
  
  for (const file of allFiles) {
    totalCount++;
    if (fs.existsSync(file) && fixFile(file)) {
      fixedCount++;
    }
  }
  
  console.log(`\nProcessed ${totalCount} files, fixed ${fixedCount} files.`);
}

// Run the script
main().catch(console.error);