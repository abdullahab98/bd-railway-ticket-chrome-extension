#!/usr/bin/env bash
# BD Railway Ticket Quick Booker - Local vs Remote Version & Git Checker

set -e

echo "=================================================="
echo "🚆 BD Railway Ticket - Version & Update Checker"
echo "=================================================="

# Read local manifest version
LOCAL_VERSION=$(grep '"version"' manifest.json | head -1 | sed -E 's/.*"version": "([^"]+)".*/\1/')
echo "🏷️  Local Version: v$LOCAL_VERSION"

# Fetch latest status from origin
echo "🔄 Checking GitHub origin/main..."
git fetch origin main --quiet 2>/dev/null || {
  echo "⚠️  Could not connect to GitHub. Check internet connection."
  exit 1
}

LOCAL_HASH=$(git rev-parse --short HEAD)
REMOTE_HASH=$(git rev-parse --short origin/main)

echo "📌 Local Git Commit:  $LOCAL_HASH"
echo "🌐 Remote Git Commit: $REMOTE_HASH"

BEHIND_COUNT=$(git rev-list --count HEAD..origin/main)
AHEAD_COUNT=$(git rev-list --count origin/main..HEAD)

echo "--------------------------------------------------"
if [ "$BEHIND_COUNT" -gt 0 ]; then
  echo "⚠️  STATUS: BACKDATED (Update Available!)"
  echo "   Your local code is $BEHIND_COUNT commit(s) behind GitHub origin/main."
  echo "👉 Run the following command to update:"
  echo "   git pull origin main"
elif [ "$AHEAD_COUNT" -gt 0 ]; then
  echo "🚀 STATUS: LOCAL AHEAD"
  echo "   You have $AHEAD_COUNT local commit(s) that are not pushed to GitHub yet."
  echo "👉 Run 'git push origin main' when ready."
else
  echo "✅ STATUS: UP TO DATE"
  echo "   Your local code matches GitHub origin/main perfectly (v$LOCAL_VERSION · $LOCAL_HASH)."
fi
echo "=================================================="

