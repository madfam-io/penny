#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Files that have trailing quotes
const filesToFix = [
  'apps/web/src/components/ui/Modal.tsx',
  'apps/web/src/routes/AuthRoutes.tsx',
  'apps/web/src/utils/artifacts/exporter.ts',
  'apps/web/src/components/ui/LoadingSpinner.tsx',
  'apps/web/src/hooks/artifacts/useArtifact.ts',
  'apps/web/src/hooks/useAuth.ts',
  'apps/web/src/store/artifactStore.ts'
];

// Function to fix trailing quotes
function fixFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    const originalContent = content;
    
    // Remove trailing quotes after closing braces
    content = content.replace(/\}\"$/m, '}');
    content = content.replace(/\}\"$/gm, '}');
    
    // Remove trailing quotes at end of file
    if (content.endsWith('}"')) {
      content = content.slice(0, -1);
    }
    
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
  let fixedCount = 0;
  let totalCount = 0;
  
  for (const file of filesToFix) {
    totalCount++;
    if (fs.existsSync(file) && fixFile(file)) {
      fixedCount++;
    }
  }
  
  console.log(`\nProcessed ${totalCount} files, fixed ${fixedCount} files.`);
}

// Run the script
main().catch(console.error);