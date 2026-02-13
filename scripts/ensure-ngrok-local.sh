#!/bin/bash
# =============================================================================
# Ensure ngrok tunnel to local Supabase (port 54321) and generate env file
# =============================================================================
# Usage: ./scripts/ensure-ngrok-local.sh
#
# Scope:
# - Android/device local development using ngrok tunnel
# - Not for browser ng serve startup
# - Browser local DB workflow: ng serve --configuration=local (http://127.0.0.1:54321)
#
# 1. Uses NGROK_SUPABASE_URL if set
# 2. Else reads ngrok API (http://127.0.0.1:4040) for existing tunnel to 54321
# 3. Else starts ngrok http 54321 in background and waits for URL
#
# Writes: src/environments/environment.local-ngrok.generated.ts
# Run before: ng build --configuration=local-ngrok (or android-build.sh ... local)
# =============================================================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
TEMPLATE="$PROJECT_ROOT/src/environments/environment.local-ngrok.template.ts"
OUTPUT="$PROJECT_ROOT/src/environments/environment.local-ngrok.generated.ts"
NGROK_API="http://127.0.0.1:4040/api/tunnels"
SUPABASE_LOCAL_PORT="54321"

get_url_from_ngrok_api() {
  local raw
  raw=$(curl -s "$NGROK_API" 2>/dev/null) || true
  if [ -z "$raw" ]; then
    echo ""
    return
  fi
  if command -v jq &>/dev/null; then
    echo "$raw" | jq -r --arg port "$SUPABASE_LOCAL_PORT" '.tunnels[]? | select((.config.addr | tostring | contains($port)) or (.config.addr | tostring | endswith(":" + $port))) | .public_url' | head -1
  else
    # Without jq we take the first tunnel; ensure it's for 54321 by checking response contains the port
    if echo "$raw" | grep -q "\"$SUPABASE_LOCAL_PORT\""; then
      echo "$raw" | grep -o '"public_url":"[^"]*"' | head -1 | sed 's/"public_url":"\(.*\)"/\1/'
    else
      echo ""
    fi
  fi
}

echo ""
echo -e "${BLUE}Ensuring ngrok tunnel to local Supabase (port $SUPABASE_LOCAL_PORT)...${NC}"
echo -e "${BLUE}Android/device local workflow only. Browser local DB should use --configuration=local.${NC}"

# 1. Use env var if set
if [ -n "$NGROK_SUPABASE_URL" ]; then
  SUPABASE_URL="$NGROK_SUPABASE_URL"
  echo -e "${GREEN}Using NGROK_SUPABASE_URL=${SUPABASE_URL}${NC}"
else
  # 2. Try ngrok API for existing tunnel
  SUPABASE_URL=$(get_url_from_ngrok_api)

  if [ -z "$SUPABASE_URL" ] || [ "$SUPABASE_URL" = "null" ]; then
    # 3. Start ngrok in background
    if ! command -v ngrok &>/dev/null; then
      echo -e "${RED}ngrok not found. Install it or set NGROK_SUPABASE_URL to your tunnel URL.${NC}"
      echo "  Example: export NGROK_SUPABASE_URL=https://your-tunnel.ngrok-free.app"
      exit 1
    fi
    echo -e "${YELLOW}No tunnel found. Starting ngrok http $SUPABASE_LOCAL_PORT...${NC}"
    (ngrok http "$SUPABASE_LOCAL_PORT" --log=stdout &>/dev/null &)
    for i in {1..15}; do
      sleep 1
      SUPABASE_URL=$(get_url_from_ngrok_api)
      [ -n "$SUPABASE_URL" ] && [ "$SUPABASE_URL" != "null" ] && break
    done
  fi
fi

if [ -z "$SUPABASE_URL" ] || [ "$SUPABASE_URL" = "null" ]; then
  echo -e "${RED}Could not get ngrok URL for Supabase.${NC}"
  echo "  Ensure local Supabase is running: supabase start"
  echo "  Start a tunnel manually: ngrok http $SUPABASE_LOCAL_PORT"
  echo "  Then: export NGROK_SUPABASE_URL=https://your-tunnel.ngrok-free.app"
  exit 1
fi

# Strip trailing slash for consistency
SUPABASE_URL="${SUPABASE_URL%/}"

if [ ! -f "$TEMPLATE" ]; then
  echo -e "${RED}Template not found: $TEMPLATE${NC}"
  exit 1
fi

# Replace placeholder and write generated file
if sed "s|__SUPABASE_NGROK_URL__|$SUPABASE_URL|g" "$TEMPLATE" > "$OUTPUT"; then
  echo -e "${GREEN}Wrote $OUTPUT (Supabase URL: $SUPABASE_URL)${NC}"
else
  echo -e "${RED}Failed to write $OUTPUT${NC}"
  exit 1
fi
echo ""
