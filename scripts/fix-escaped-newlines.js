#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Find all TSX files in the admin app
const files = glob.sync(path.join(__dirname, '../apps/admin/**/*.tsx'));

console.log(`Found ${files.length} TSX files to check...`);

let fixedCount = 0;

files.forEach((filePath) => {
  const content = fs.readFileSync(filePath, 'utf8');
  
  // Replace literal \n with actual newlines
  const fixed = content.replace(/\\n/g, '\n');
  
  if (content !== fixed) {
    fs.writeFileSync(filePath, fixed);
    console.log(`Fixed: ${path.relative(process.cwd(), filePath)}`);
    fixedCount++;
  }
});

console.log(`\n✅ Fixed ${fixedCount} files with escaped newlines`);