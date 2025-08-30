#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Files identified as having errors
const problemFiles = [
  'apps/web/src/components/Header.tsx',
  'apps/web/src/components/ArtifactViewer.tsx',
  'apps/web/src/components/MessageBubble.tsx',
  'apps/web/src/components/Sidebar.tsx',
  'apps/web/src/components/auth/SessionManager.tsx',
  'apps/web/src/components/artifacts/**/*.tsx',
  'apps/web/src/components/billing/**/*.tsx',
  'apps/web/src/components/monitoring/**/*.tsx',
  'apps/web/src/components/sandbox/**/*.tsx',
  'apps/web/src/components/tools/**/*.tsx',
  'apps/web/src/components/ui/**/*.tsx',
  'apps/web/src/hooks/**/*.ts',
  'apps/web/src/pages/**/*.tsx',
  'apps/web/src/store/**/*.ts',
  'apps/web/src/utils/**/*.ts',
  'apps/web/src/__tests__/**/*.tsx'
];

// Function to fix remaining escaped characters
function fixFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    const originalContent = content;
    
    // Fix escaped newlines in JSX elements (more aggressive)
    content = content.replace(/>\s*\\n\s*</g, '>\n<');
    content = content.replace(/>\s*\\n\s*/g, '>\n');
    content = content.replace(/\s*\\n\s*</g, '\n<');
    
    // Fix escaped newlines in className attributes
    content = content.replace(/className="([^"]+)\\n\s*/g, 'className="$1"\n');
    
    // Fix component props with escaped newlines
    content = content.replace(/(\w+)=\{([^}]+)\}\\n/g, '$1={$2}\n');
    content = content.replace(/(\w+)="([^"]+)"\\n/g, '$1="$2"\n');
    
    // Fix escaped quotes in strings
    content = content.replace(/\\"/g, '"');
    content = content.replace(/\\'/g, "'");
    
    // Fix return statements with escaped newlines
    content = content.replace(/return \(\\n/g, 'return (\n');
    content = content.replace(/\) \{\\n/g, ') {\n');
    
    // Fix JSX fragments with escaped newlines
    content = content.replace(/<>\\n/g, '<>\n');
    content = content.replace(/\\n<\//g, '\n</');
    
    // Fix else/if statements with escaped newlines
    content = content.replace(/\} else \{\\n/g, '} else {\n');
    content = content.replace(/\} else if/g, '} else if');
    
    // Fix function declarations with escaped newlines
    content = content.replace(/function (\w+)\(([^)]*)\) \{\\n/g, 'function $1($2) {\n');
    content = content.replace(/const (\w+) = \(([^)]*)\) => \{\\n/g, 'const $1 = ($2) => {\n');
    
    // Fix imports with escaped newlines
    content = content.replace(/;\\nimport /g, ';\nimport ');
    content = content.replace(/;\\n/g, ';\n');
    
    // Fix brackets and braces with escaped newlines
    content = content.replace(/\{\\n/g, '{\n');
    content = content.replace(/\}\\n/g, '}\n');
    content = content.replace(/\[\\n/g, '[\n');
    content = content.replace(/\]\\n/g, ']\n');
    
    // Fix specific patterns found in error logs
    content = content.replace(/\)\\n\s+<(\w+)/g, ')\n          <$1');
    content = content.replace(/>\\n\s+\{/g, '>\n          {');
    
    // Clean up any double newlines created
    content = content.replace(/\n\n\n+/g, '\n\n');
    
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
  let allFiles = [];
  
  // Expand all glob patterns
  for (const pattern of problemFiles) {
    const files = glob.sync(pattern, {
      ignore: ['**/node_modules/**', '**/dist/**', '**/build/**']
    });
    allFiles = allFiles.concat(files);
  }
  
  // Remove duplicates
  allFiles = [...new Set(allFiles)];
  
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