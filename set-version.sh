#!/usr/bin/env bash
# Quick Version Updater Utility for BD Railway Ticket Extension

set -e

NEW_VERSION="$1"

if [ -z "$NEW_VERSION" ]; then
  echo "Usage: ./set-version.sh <version>"
  echo "Example: ./set-version.sh 1.0.2"
  exit 1
fi

# Clean version (remove leading 'v' if provided)
NEW_VERSION=$(echo "$NEW_VERSION" | sed 's/^v//')

echo "Updating extension version to: v$NEW_VERSION"

# 1. Update manifest.json
sed -i -E "s/\"version\": \"[0-9]+\.[0-9]+\.[0-9]+\"/\"version\": \"$NEW_VERSION\"/" manifest.json
echo "✓ Updated manifest.json"

# 2. Update popup/popup.js CURRENT_VERSION
sed -i -E "s/const CURRENT_VERSION = '[^']+';/const CURRENT_VERSION = '$NEW_VERSION';/" popup/popup.js
echo "✓ Updated popup/popup.js"

# 3. Update popup/popup.html default display
sed -i -E "s/<strong id=\"app-version\">v[^<]+<\/strong>/<strong id=\"app-version\">v$NEW_VERSION<\/strong>/" popup/popup.html
echo "✓ Updated popup/popup.html"

echo ""
echo "🎉 Version successfully updated to v$NEW_VERSION across all files!"
echo "👉 You can now commit and push when ready:"
echo "   git add -A && git commit -m \"chore: bump version to $NEW_VERSION\" && git push origin main"
