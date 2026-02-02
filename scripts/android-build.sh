#!/bin/bash

# =============================================================================
# Android Build Script for After5
# =============================================================================
# Usage:
#   ./scripts/android-build.sh [command] [flavor] [environment]
#
# Commands:
#   run      - Build and run on device/emulator
#   build    - Build APK
#   bundle   - Build AAB for Play Store
#   sync     - Only sync (no build)
#
# Flavors:
#   customer - After5 customer app (default)
#   experts  - After5 Experts provider app
#
# Environments:
#   dev      - Development environment (default, remote Supabase)
#   local    - Local Supabase via ngrok (for Android/device testing)
#   prod     - Production environment
#
# Examples:
#   ./scripts/android-build.sh run customer dev
#   ./scripts/android-build.sh bundle experts prod
#   ./scripts/android-build.sh build customer prod
# =============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Show help
show_help() {
    echo ""
    echo -e "${BLUE}After5 Android Build Script${NC}"
    echo ""
    echo "Usage: ./scripts/android-build.sh [command] [flavor] [environment]"
    echo ""
    echo "Commands:"
    echo "  run      Build and run on device/emulator"
    echo "  build    Build APK"
    echo "  bundle   Build AAB for Play Store"
    echo "  sync     Only sync Capacitor (no Angular build)"
    echo ""
    echo "Flavors:"
    echo "  customer After5 customer app (default)"
    echo "  experts  After5 Experts provider app"
    echo ""
    echo "Environments:"
    echo "  dev      Development build (default, remote Supabase)"
    echo "  local    Local Supabase via ngrok (for Android/device)"
    echo "  prod     Production build"
    echo ""
    echo "Examples:"
    echo "  ./scripts/android-build.sh run customer dev"
    echo "  ./scripts/android-build.sh bundle experts prod"
    echo "  ./scripts/android-build.sh build customer prod"
    echo ""
    echo "NPM Scripts:"
    echo "  npm run android:run:customer       Run customer dev"
    echo "  npm run android:run:experts        Run experts dev"
    echo "  npm run android:bundle:customer    Bundle customer for Play Store"
    echo "  npm run android:bundle:experts     Bundle experts for Play Store"
    echo ""
    exit 0
}

# Check for help flag
if [[ "$1" == "-h" || "$1" == "--help" || "$1" == "help" ]]; then
    show_help
fi

# Default values
COMMAND="${1:-run}"
FLAVOR="${2:-customer}"
ENVIRONMENT="${3:-dev}"

# Validate command
if [[ ! "$COMMAND" =~ ^(run|build|bundle|sync)$ ]]; then
    echo -e "${RED}Error: Invalid command '$COMMAND'${NC}"
    echo "Valid commands: run, build, bundle, sync"
    echo "Run './scripts/android-build.sh --help' for usage"
    exit 1
fi

# Validate flavor
if [[ ! "$FLAVOR" =~ ^(customer|experts)$ ]]; then
    echo -e "${RED}Error: Invalid flavor '$FLAVOR'${NC}"
    echo "Valid flavors: customer, experts"
    exit 1
fi

# Validate environment
if [[ ! "$ENVIRONMENT" =~ ^(dev|prod|local)$ ]]; then
    echo -e "${RED}Error: Invalid environment '$ENVIRONMENT'${NC}"
    echo "Valid environments: dev, prod, local"
    exit 1
fi

# Map environment to Angular configuration
if [ "$ENVIRONMENT" == "prod" ]; then
    NG_CONFIG="production"
    BUILD_TYPE="Release"
elif [ "$ENVIRONMENT" == "local" ]; then
    NG_CONFIG="local-ngrok"
    BUILD_TYPE="Debug"
else
    NG_CONFIG="development"
    BUILD_TYPE="Debug"
fi

# Capitalize first letter for Gradle task
FLAVOR_CAP="$(tr '[:lower:]' '[:upper:]' <<< ${FLAVOR:0:1})${FLAVOR:1}"

echo ""
echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║             After5 Android Build Script                   ║${NC}"
echo -e "${BLUE}╠════════════════════════════════════════════════════════════╣${NC}"
echo -e "${BLUE}║${NC} Command:     ${GREEN}$COMMAND${NC}"
echo -e "${BLUE}║${NC} Flavor:      ${GREEN}$FLAVOR${NC}"
echo -e "${BLUE}║${NC} Environment: ${GREEN}$ENVIRONMENT${NC}"
echo -e "${BLUE}║${NC} Build Type:  ${GREEN}$BUILD_TYPE${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Step 1: Build Angular app (skip for sync-only)
if [ "$COMMAND" != "sync" ]; then
    if [ "$ENVIRONMENT" == "local" ]; then
        echo -e "${YELLOW}[0/3] Ensuring ngrok tunnel to local Supabase...${NC}"
        "$SCRIPT_DIR/ensure-ngrok-local.sh"
        echo ""
    fi
    echo -e "${YELLOW}[1/3] Building Angular app ($NG_CONFIG)...${NC}"
    if [ "$ENVIRONMENT" == "prod" ]; then
        npm run build -- --configuration=production
    elif [ "$ENVIRONMENT" == "local" ]; then
        npm run build -- --configuration=local-ngrok
    else
        npm run build
    fi
    echo -e "${GREEN}✓ Angular build complete${NC}"
    echo ""
fi

# Step 2: Sync Capacitor
echo -e "${YELLOW}[2/3] Syncing Capacitor...${NC}"
npx cap sync android
echo -e "${GREEN}✓ Capacitor sync complete${NC}"
echo ""

# Step 3: Execute Android command
case $COMMAND in
    run)
        echo -e "${YELLOW}[3/3] Running on Android device/emulator...${NC}"
        npx cap run android --flavor $FLAVOR
        ;;
    build)
        echo -e "${YELLOW}[3/3] Building APK (${FLAVOR_CAP}${BUILD_TYPE})...${NC}"
        cd android
        if [ "$ENVIRONMENT" == "prod" ]; then
            ./gradlew assemble${FLAVOR_CAP}Release
            APK_PATH="app/build/outputs/apk/${FLAVOR}/release/app-${FLAVOR}-release.apk"
        else
            ./gradlew assemble${FLAVOR_CAP}Debug
            APK_PATH="app/build/outputs/apk/${FLAVOR}/debug/app-${FLAVOR}-debug.apk"
        fi
        cd ..
        echo -e "${GREEN}✓ APK built: android/$APK_PATH${NC}"
        ;;
    bundle)
        echo -e "${YELLOW}[3/3] Building AAB for Play Store (${FLAVOR_CAP}Release)...${NC}"
        cd android
        ./gradlew bundle${FLAVOR_CAP}Release
        cd ..
        BUNDLE_PATH="android/app/build/outputs/bundle/${FLAVOR}Release/app-${FLAVOR}-release.aab"
        MAPPING_PATH="android/app/build/outputs/mapping/${FLAVOR}Release/mapping.txt"
        echo ""
        echo -e "${GREEN}✓ Bundle built successfully!${NC}"
        echo -e "${BLUE}Bundle:  ${NC}$BUNDLE_PATH"
        echo -e "${BLUE}Mapping: ${NC}$MAPPING_PATH"
        ;;
    sync)
        echo -e "${YELLOW}[3/3] Sync only - skipping build${NC}"
        ;;
esac

echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║                    Build Complete!                         ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
