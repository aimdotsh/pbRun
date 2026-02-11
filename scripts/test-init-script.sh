#!/bin/bash
# Test script for init-garmin-data.js

echo "Testing init-garmin-data.js script..."
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed"
    exit 1
fi

echo "✓ Node.js version: $(node --version)"

# Check if script exists
if [ ! -f "scripts/init-garmin-data.js" ]; then
    echo "❌ init-garmin-data.js not found"
    exit 1
fi

echo "✓ Init script found"

# Check if script is executable
if [ ! -x "scripts/init-garmin-data.js" ]; then
    echo "⚠ Script is not executable, adding execute permission..."
    chmod +x scripts/init-garmin-data.js
fi

echo "✓ Script is executable"

# Check package.json for script
if grep -q "init:garmin:data" package.json; then
    echo "✓ npm script configured in package.json"
else
    echo "❌ npm script not found in package.json"
    exit 1
fi

# Test script help/dry-run (without actually running sync)
echo ""
echo "Script check complete! ✓"
echo ""
echo "To run the initialization:"
echo "  npm run init:garmin:data"
echo ""
echo "Or with tnpm:"
echo "  tnpm run init:garmin:data"
