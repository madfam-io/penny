#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Function to fix remaining escaped characters
function fixFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    const originalContent = content;
    
    // Fix lines that start with \n
    content = content.replace(/^\\n( +)/gm, '\n$1');
    
    // Fix return statements with \n
    content = content.replace(/return \(\\n/g, 'return (\n');
    
    // Fix JSX elements with \n  
    content = content.replace(/<div className="(.+?)">\n/g, '<div className="$1">\n');
    content = content.replace(/\) \{\\n/g, ') {\n');
    
    // Fix other common patterns
    content = content.replace(/\}\\n/g, '}\n');
    content = content.replace(/;\\n/g, ';\n');
    
    // Fix escaped quotes in class names
    content = content.replace(/className=\\"(.+?)\\"/g, 'className="$1"');
    
    // Fix template literal issues
    content = content.replace(/\$\{(.+?)\}\\n/g, '${$1}\n');
    
    // Fix specific component issues
    content = content.replace(/\s+\\n\s+/g, '\n    ');
    
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
  const files = [
    'apps/web/src/components/ArtifactViewer.tsx',
    'apps/web/src/components/Header.tsx',
    'apps/web/src/components/MessageBubble.tsx',
    'apps/web/src/__tests__/components/ArtifactViewer.test.tsx'
  ];
  
  // Also process all tsx files in web/src
  const allFiles = glob.sync('apps/web/src/**/*.{ts,tsx}', {
    ignore: ['**/node_modules/**', '**/dist/**', '**/build/**']
  });
  
  let fixedCount = 0;
  let totalCount = 0;
  
  // Process specific problem files first
  for (const file of files) {
    totalCount++;
    if (fs.existsSync(file) && fixFile(file)) {
      fixedCount++;
    }
  }
  
  // Then process all files
  for (const file of allFiles) {
    totalCount++;
    if (fixFile(file)) {
      fixedCount++;
    }
  }
  
  console.log(`\nProcessed ${totalCount} files, fixed ${fixedCount} files.`);
}

// Run the script
main().catch(console.error);