#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Files identified as having unterminated string literal errors
const problemFiles = [
  'apps/web/src/components/artifacts/renderers/CodeRenderer.tsx',
  'apps/web/src/components/artifacts/renderers/MarkdownRenderer.tsx',
  'apps/web/src/components/auth/SessionManager.tsx',
  'apps/web/src/components/auth/index.ts',
  'apps/web/src/components/monitoring/LogViewer.tsx',
  'apps/web/src/components/sandbox/OutputPanel.tsx',
  'apps/web/src/components/ui/LoadingSpinner.tsx',
  'apps/web/src/components/ui/Modal.tsx',
  'apps/web/src/hooks/artifacts/useArtifact.ts',
  'apps/web/src/hooks/useAuth.ts',
  'apps/web/src/routes/AuthRoutes.tsx',
  'apps/web/src/store/artifactStore.ts',
  'apps/web/src/utils/artifacts/detector.ts',
  'apps/web/src/utils/artifacts/exporter.ts'
];

// Function to fix unterminated string literals
function fixFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    const originalContent = content;
    
    // Fix split() calls with newline literals
    // Look for .split(' followed by a newline and ')
    content = content.replace(/\.split\('[\r\n]+'\)/g, ".split('\\n')");
    
    // Fix template literals that span multiple lines incorrectly
    // Look for strings that start with ' or " and have actual newlines in them
    const lines = content.split('\n');
    let inString = false;
    let stringChar = '';
    let fixedLines = [];
    
    for (let i = 0; i < lines.length; i++) {
      let line = lines[i];
      
      // Check if we're in the middle of a string from previous line
      if (inString) {
        // This line is part of an unterminated string
        // Add it as continuation with proper escaping
        const prevLine = fixedLines[fixedLines.length - 1];
        fixedLines[fixedLines.length - 1] = prevLine.slice(0, -1) + '\\n' + stringChar;
        fixedLines.push(line);
        inString = false;
        continue;
      }
      
      // Check for .split(' pattern followed by newline
      if (line.includes(".split('") && !line.includes(".split('\\n')")) {
        const splitMatch = line.match(/\.split\('$/);
        if (splitMatch) {
          // This line ends with .split(' and next line should be ')
          if (i + 1 < lines.length && lines[i + 1].trim().startsWith("')")) {
            line = line.slice(0, -1) + "\\n'";
            lines[i + 1] = lines[i + 1].replace(/^\s*'\)/, ')');
          }
        }
      }
      
      // Check for other string patterns with embedded newlines
      // Look for patterns like: "some text<newline>
      const openQuoteMatch = line.match(/(["'])$/);
      if (openQuoteMatch && i + 1 < lines.length) {
        const nextLine = lines[i + 1];
        const closeQuoteMatch = nextLine.match(new RegExp('^\\s*' + openQuoteMatch[1]));
        if (closeQuoteMatch) {
          // Found string split across lines
          line = line.slice(0, -1) + '\\n' + openQuoteMatch[1];
          lines[i + 1] = nextLine.replace(new RegExp('^\\s*' + openQuoteMatch[1]), '');
        }
      }
      
      fixedLines.push(line);
    }
    
    content = fixedLines.join('\n');
    
    // Additional specific fixes for common patterns
    // Fix code.split(' followed by newline
    content = content.replace(/code\.split\('\n'\)/g, "code.split('\\n')");
    
    // Fix similar patterns with join
    content = content.replace(/\.join\('\n'\)/g, ".join('\\n')");
    
    // Fix includes patterns
    content = content.replace(/\.includes\('\n'\)/g, ".includes('\\n')");
    
    // Fix regex patterns that may have been broken
    content = content.replace(/\/(\\r)?\\n/g, '/\\n');
    
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
  
  for (const file of problemFiles) {
    totalCount++;
    if (fs.existsSync(file) && fixFile(file)) {
      fixedCount++;
    }
  }
  
  console.log(`\nProcessed ${totalCount} files, fixed ${fixedCount} files.`);
}

// Run the script
main().catch(console.error);