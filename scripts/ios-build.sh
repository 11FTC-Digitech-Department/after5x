#!/bin/bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
XCODE_PROJECT="$ROOT_DIR/ios/App/App.xcodeproj"
PBXPROJ_PATH="$XCODE_PROJECT/project.pbxproj"
EXPORT_OPTIONS_PLIST="$SCRIPT_DIR/ios-export-options-app-store.plist"
BUILD_ROOT="$ROOT_DIR/ios/build"
DERIVED_DATA_PATH="$ROOT_DIR/ios/DerivedData"
SOURCE_PACKAGES_PATH="$ROOT_DIR/ios/SourcePackages"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

show_help() {
    echo ""
    echo -e "${BLUE}After5 iOS Build Script${NC}"
    echo ""
    echo "Usage: ./scripts/ios-build.sh [command] [flavor] [environment]"
    echo ""
    echo "Commands:"
    echo "  archive  Build web assets, sync Capacitor, and create an .xcarchive"
    echo "  bundle   Build web assets, sync Capacitor, archive, export IPA, and copy it to ~/Downloads"
    echo "  sync     Only sync Capacitor for iOS"
    echo ""
    echo "Flavors:"
    echo "  customer After5 customer app (default)"
    echo "  experts  After5 Experts provider app"
    echo ""
    echo "Environments:"
    echo "  dev      Development web build (default)"
    echo "  prod     Production web build"
    echo ""
    echo "Examples:"
    echo "  ./scripts/ios-build.sh sync customer dev"
    echo "  ./scripts/ios-build.sh archive customer prod"
    echo "  ./scripts/ios-build.sh bundle experts prod"
    echo ""
    exit 0
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" || "${1:-}" == "help" ]]; then
    show_help
fi

COMMAND="${1:-bundle}"
FLAVOR="${2:-customer}"
ENVIRONMENT="${3:-dev}"

if [[ ! "$COMMAND" =~ ^(archive|bundle|sync)$ ]]; then
    echo -e "${RED}Error: Invalid command '$COMMAND'${NC}"
    echo "Valid commands: archive, bundle, sync"
    exit 1
fi

if [[ ! "$FLAVOR" =~ ^(customer|experts)$ ]]; then
    echo -e "${RED}Error: Invalid flavor '$FLAVOR'${NC}"
    echo "Valid flavors: customer, experts"
    exit 1
fi

if [[ ! "$ENVIRONMENT" =~ ^(dev|prod)$ ]]; then
    echo -e "${RED}Error: Invalid environment '$ENVIRONMENT'${NC}"
    echo "Valid environments: dev, prod"
    exit 1
fi

if [[ "$FLAVOR" == "customer" ]]; then
    SCHEME="AppCustomer"
    FIREBASE_PLIST="$ROOT_DIR/ios/App/Firebase/customer/GoogleService-Info.plist"
    PRODUCT_BUNDLE_IDENTIFIER="com.rockit.after5"
else
    SCHEME="AppExperts"
    FIREBASE_PLIST="$ROOT_DIR/ios/App/Firebase/experts/GoogleService-Info.plist"
    PRODUCT_BUNDLE_IDENTIFIER="com.rockit.after5.experts"
fi

if [[ "$ENVIRONMENT" == "prod" ]]; then
    NG_CONFIG="production"
    ARTIFACT_ENV_LABEL="live"
else
    NG_CONFIG="development"
    ARTIFACT_ENV_LABEL="dev"
fi

if [[ ! -d "$XCODE_PROJECT" ]]; then
    echo -e "${RED}Error: Xcode project not found at $XCODE_PROJECT${NC}"
    exit 1
fi

if [[ ! -f "$PBXPROJ_PATH" ]]; then
    echo -e "${RED}Error: Xcode project file not found at $PBXPROJ_PATH${NC}"
    exit 1
fi

if [[ ! -f "$ROOT_DIR/ios/App/App.xcodeproj/xcshareddata/xcschemes/$SCHEME.xcscheme" ]]; then
    echo -e "${RED}Error: Shared scheme '$SCHEME' not found${NC}"
    exit 1
fi

if [[ ! -f "$EXPORT_OPTIONS_PLIST" ]]; then
    echo -e "${RED}Error: Export options plist not found at $EXPORT_OPTIONS_PLIST${NC}"
    exit 1
fi

mkdir -p "$BUILD_ROOT" "$DERIVED_DATA_PATH" "$SOURCE_PACKAGES_PATH"

VERSION_NAME="$(awk -F ' = ' '/MARKETING_VERSION = / { gsub(/;$/, "", $2); print $2; exit }' "$PBXPROJ_PATH")"
VERSION_CODE="$(awk -F ' = ' '/CURRENT_PROJECT_VERSION = / { gsub(/;$/, "", $2); print $2; exit }' "$PBXPROJ_PATH")"

if [[ -z "$VERSION_NAME" || -z "$VERSION_CODE" ]]; then
    echo -e "${RED}Error: Failed to read version info from $PBXPROJ_PATH${NC}"
    exit 1
fi

ARCHIVE_DIR="$BUILD_ROOT/$FLAVOR/$ENVIRONMENT"
ARCHIVE_PATH="$ARCHIVE_DIR/$SCHEME.xcarchive"
EXPORT_PATH="$ARCHIVE_DIR/export"

echo ""
echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║               After5 iOS Build Script                     ║${NC}"
echo -e "${BLUE}╠════════════════════════════════════════════════════════════╣${NC}"
echo -e "${BLUE}║${NC} Version:     ${GREEN}$VERSION_NAME (build $VERSION_CODE)${NC}"
echo -e "${BLUE}║${NC} Command:     ${GREEN}$COMMAND${NC}"
echo -e "${BLUE}║${NC} Flavor:      ${GREEN}$FLAVOR${NC}"
echo -e "${BLUE}║${NC} Scheme:      ${GREEN}$SCHEME${NC}"
echo -e "${BLUE}║${NC} Environment: ${GREEN}$ENVIRONMENT${NC}"
echo -e "${BLUE}║${NC} Bundle ID:   ${GREEN}$PRODUCT_BUNDLE_IDENTIFIER${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

if [ "$COMMAND" != "sync" ]; then
    echo -e "${YELLOW}[1/4] Building Angular app ($NG_CONFIG)...${NC}"
    npm run build -- --configuration="$NG_CONFIG"
    echo -e "${GREEN}✓ Angular build complete${NC}"
    echo ""
fi

echo -e "${YELLOW}[2/4] Syncing Capacitor for iOS...${NC}"
npx cap sync ios
echo -e "${GREEN}✓ Capacitor sync complete${NC}"
echo ""

if [ "$COMMAND" = "sync" ]; then
    echo -e "${YELLOW}[3/4] Sync only - skipping archive/export${NC}"
    exit 0
fi

if [[ ! -f "$FIREBASE_PLIST" ]]; then
    echo -e "${RED}Error: Missing Firebase config for '$FLAVOR' at $FIREBASE_PLIST${NC}"
    exit 1
fi

if grep -q "__PLACEHOLDER__" "$FIREBASE_PLIST"; then
    echo -e "${RED}Error: Placeholder Firebase config detected for '$FLAVOR' at $FIREBASE_PLIST${NC}"
    echo "Replace it with the real GoogleService-Info.plist before archiving or exporting."
    exit 1
fi

rm -rf "$ARCHIVE_PATH" "$EXPORT_PATH"
mkdir -p "$ARCHIVE_DIR"

echo -e "${YELLOW}[3/4] Archiving $SCHEME...${NC}"
xcodebuild archive \
    -project "$XCODE_PROJECT" \
    -scheme "$SCHEME" \
    -configuration Release \
    -destination generic/platform=iOS \
    -archivePath "$ARCHIVE_PATH" \
    -derivedDataPath "$DERIVED_DATA_PATH" \
    -clonedSourcePackagesDirPath "$SOURCE_PACKAGES_PATH"
echo -e "${GREEN}✓ Archive created at $ARCHIVE_PATH${NC}"
echo ""

if [ "$COMMAND" = "archive" ]; then
    echo -e "${BLUE}Archive:${NC} $ARCHIVE_PATH"
    exit 0
fi

echo -e "${YELLOW}[4/4] Exporting IPA for TestFlight...${NC}"
xcodebuild -exportArchive \
    -archivePath "$ARCHIVE_PATH" \
    -exportPath "$EXPORT_PATH" \
    -exportOptionsPlist "$EXPORT_OPTIONS_PLIST"

IPA_PATH="$(find "$EXPORT_PATH" -maxdepth 1 -type f -name '*.ipa' | head -1)"
if [[ -z "$IPA_PATH" ]]; then
    echo -e "${RED}Error: No IPA was exported to $EXPORT_PATH${NC}"
    exit 1
fi

RENAMED_IPA="after5-${FLAVOR}-${ARTIFACT_ENV_LABEL}-v.${VERSION_NAME}.ipa"
RENAMED_IPA_PATH="$EXPORT_PATH/$RENAMED_IPA"
mv "$IPA_PATH" "$RENAMED_IPA_PATH"

DOWNLOADS_DIR="$HOME/Downloads"
mkdir -p "$DOWNLOADS_DIR"
cp "$RENAMED_IPA_PATH" "$DOWNLOADS_DIR/"

echo ""
echo -e "${GREEN}✓ IPA exported successfully!${NC}"
echo -e "${BLUE}Archive:${NC}  $ARCHIVE_PATH"
echo -e "${BLUE}Export:${NC}   $RENAMED_IPA_PATH"
echo -e "${BLUE}Downloads:${NC} $DOWNLOADS_DIR/$RENAMED_IPA"
echo ""
