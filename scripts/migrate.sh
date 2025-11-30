#!/bin/bash

# Migration script: Swap old HTML files with new Vite-ready versions
# Run this after reviewing the new files and confirming they work

set -e

echo "🔮 Sigilweaver Website Migration Script"
echo "========================================"
echo ""

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: Run this script from the project root (sigilweaver.app)"
    exit 1
fi

echo "📦 Step 1: Installing dependencies..."
npm install

echo ""
echo "🧪 Step 2: Testing build..."
npm run build

if [ $? -ne 0 ]; then
    echo "❌ Build failed. Please fix errors before migrating."
    exit 1
fi

echo ""
echo "✅ Build successful!"
echo ""
echo "📁 Step 3: Swapping HTML files..."

# Backup old files
mkdir -p .backup
cp index.html .backup/index.old.html 2>/dev/null || true
cp downloads.html .backup/downloads.old.html 2>/dev/null || true

# Swap new files
if [ -f "index.new.html" ]; then
    mv index.html index.old.html
    mv index.new.html index.html
    echo "   ✓ index.html updated"
fi

if [ -f "downloads.new.html" ]; then
    mv downloads.html downloads.old.html
    mv downloads.new.html downloads.html
    echo "   ✓ downloads.html updated"
fi

echo ""
echo "🎉 Migration complete!"
echo ""
echo "Next steps:"
echo "  1. Run 'npm run dev' to start the development server"
echo "  2. Test all pages thoroughly"
echo "  3. Update remaining pages (contributing.html, terms.html, etc.)"
echo "  4. Delete old files when satisfied: rm *.old.html"
echo ""
echo "Old files backed up to .backup/"
