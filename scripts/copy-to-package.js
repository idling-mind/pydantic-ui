/**
 * Build script to copy the compiled frontend to the Python package.
 * 
 * This script copies the Vite build output to pydantic_ui/static/
 * so it can be served by the FastAPI backend.
 */

const fs = require('fs');
const path = require('path');

const SOURCE_DIR = path.join(__dirname, '..', 'frontend', 'dist');
const TARGET_DIR = path.join(__dirname, '..', 'pydantic_ui', 'static');

function copyRecursive(src, dest) {
  // Create destination directory if it doesn't exist
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
      console.log(`  Copied: ${entry.name}`);
    }
  }
}

function cleanDirectory(dir) {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
    console.log(`Cleaned: ${dir}`);
  }
}

function main() {
  console.log('\n=== Pydantic UI Build Script ===\n');

  // Check if source directory exists
  if (!fs.existsSync(SOURCE_DIR)) {
    console.error('Error: Frontend build not found.');
    console.error('Please run "npm run build" in the frontend directory first.');
    process.exit(1);
  }

  // Clean and recreate target directory
  console.log('Cleaning target directory...');
  cleanDirectory(TARGET_DIR);

  // Copy files
  console.log('\nCopying build files...');
  copyRecursive(SOURCE_DIR, TARGET_DIR);

  // Verify copy
  const files = fs.readdirSync(TARGET_DIR);
  console.log(`\nCopied ${files.length} items to ${TARGET_DIR}`);

  console.log('\n=== Build complete! ===\n');
}

main();
