#!/bin/bash

# Build script for messenger-client
# Usage: npm run build:client

echo "🏗️  Building messenger-client package..."

# Create the build directory if it doesn't exist
mkdir -p packages/messenger-client/dist

# Copy source files from src/client to packages/messenger-client/src
echo "📦 Copying source files..."
mkdir -p packages/messenger-client/src
cp -r src/client/* packages/messenger-client/src/ 2>/dev/null || true

# Move to the package directory
cd packages/messenger-client

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "📥 Installing dependencies..."
    npm install
fi

# Build TypeScript
echo "🔨 Compiling TypeScript..."
npx tsc

# Build with Rollup if configured
if [ -f "rollup.config.js" ]; then
    echo "📦 Building with Rollup..."
    npx rollup -c
fi

# Copy essential files
echo "📋 Copying essential files..."
cp README.md dist/ 2>/dev/null || true
cp ../../LICENSE dist/ 2>/dev/null || echo "⚠️  LICENSE file not found"

# Show package size
echo "📊 Package size:"
du -sh dist/

echo "✅ Build completed successfully!"
echo "📦 Package ready in: packages/messenger-client/"
echo ""
echo "To publish:"
echo "  cd packages/messenger-client"
echo "  npm publish"