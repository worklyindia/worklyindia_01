#!/bin/bash

# ===========================================
# TWA Build Script for Workly India
# ===========================================
# This script helps generate the TWA APK/AAB using Bubblewrap
# Run this from the project root directory

echo "🚀 Workly India TWA Build Script"
echo "=============================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js is not installed.${NC}"
    echo "Please install Node.js from: https://nodejs.org/"
    exit 1
fi
echo -e "${GREEN}✅ Node.js found:${NC} $(node --version)"

# Check if Java is installed
if ! command -v java &> /dev/null; then
    echo -e "${RED}❌ Java is not installed.${NC}"
    echo "Please install Java JDK 11+ from: https://adoptium.net/"
    exit 1
fi
echo -e "${GREEN}✅ Java found:${NC} $(java --version 2>&1 | head -1)"

# Check if keytool is available
if ! command -v keytool &> /dev/null; then
    echo -e "${RED}❌ keytool not found.${NC}"
    echo "keytool comes with Java JDK. Make sure JAVA_HOME is set correctly."
    exit 1
fi
echo -e "${GREEN}✅ keytool found${NC}"

# Install Bubblewrap if not already installed
echo ""
echo "📦 Checking Bubblewrap CLI..."
if ! npm list -g @bubblewrap/cli &> /dev/null; then
    echo -e "${YELLOW}Installing @bubblewrap/cli globally...${NC}"
    npm install -g @bubblewrap/cli
fi
echo -e "${GREEN}✅ Bubblewrap CLI ready${NC}"

# Create output directory
BUILD_DIR="twa-build"
mkdir -p $BUILD_DIR
cd $BUILD_DIR

echo ""
echo "=============================="
echo "📋 TWA Configuration"
echo "=============================="
echo "Package ID: online.workfromhomeindia.twa"
echo "Host: worklyindia.devs.surf"
echo "Theme: #2563eb"
echo "Build Directory: $BUILD_DIR"
echo ""

# Check if keystore exists
KEYSTORE_PATH="../android.keystore"
if [ ! -f "$KEYSTORE_PATH" ]; then
    echo -e "${YELLOW}⚠️  Keystore not found at $KEYSTORE_PATH${NC}"
    echo ""
    echo "🔑 To generate a signing keystore, run:"
    echo ""
    echo -e "${GREEN}keytool -genkeypair -alias wfhindia -keyalg RSA -keysize 2048 -validity 10000 -keystore android.keystore${NC}"
    echo ""
    echo "Then run this script again."
    exit 1
fi
echo -e "${GREEN}✅ Keystore found${NC}"

# Get SHA256 fingerprint
echo ""
echo "🔍 Getting SHA256 fingerprint..."
echo "Enter your keystore password when prompted:"
keytool -list -v -keystore $KEYSTORE_PATH -alias wfhindia 2>/dev/null | grep SHA256

echo ""
echo "=============================="
echo "🏗️ Build Options"
echo "=============================="
echo ""
echo "Choose an option:"
echo "1) Initialize TWA project (first time only)"
echo "2) Build Debug APK (for testing)"
echo "3) Build Release AAB (for Play Store)"
echo "4) Update and rebuild (after PWA changes)"
echo "5) Show all commands (manual mode)"
echo ""
read -p "Enter option (1-5): " option

case $option in
    1)
        echo ""
        echo "📱 Initializing TWA project..."
        npx @bubblewrap/cli init --manifest https://worklyindia.devs.surf/manifest.json
        ;;
    2)
        echo ""
        echo "📱 Building Debug APK..."
        npx @bubblewrap/cli build
        echo ""
        echo -e "${GREEN}✅ APK generated: app-release-signed.apk${NC}"
        ;;
    3)
        echo ""
        echo "📱 Building Release AAB for Play Store..."
        npx @bubblewrap/cli build --generateAppBundle
        echo ""
        echo -e "${GREEN}✅ AAB generated: app-release-bundle.aab${NC}"
        ;;
    4)
        echo ""
        echo "🔄 Updating TWA project..."
        npx @bubblewrap/cli update --manifest https://worklyindia.devs.surf/manifest.json
        echo ""
        echo "📱 Building..."
        npx @bubblewrap/cli build --generateAppBundle
        echo ""
        echo -e "${GREEN}✅ Update complete!${NC}"
        ;;
    5)
        echo ""
        echo "=============================="
        echo "📝 Manual Commands"
        echo "=============================="
        echo ""
        echo "# Step 1: Generate Keystore (one time only)"
        echo "keytool -genkeypair -alias wfhindia -keyalg RSA -keysize 2048 -validity 10000 -keystore android.keystore"
        echo ""
        echo "# Step 2: Get SHA256 Fingerprint"
        echo "keytool -list -v -keystore android.keystore -alias wfhindia"
        echo ""
        echo "# Step 3: Initialize TWA"
        echo "npx @bubblewrap/cli init --manifest https://worklyindia.devs.surf/manifest.json"
        echo ""
        echo "# Step 4: Build APK (testing)"
        echo "npx @bubblewrap/cli build"
        echo ""
        echo "# Step 5: Build AAB (Play Store)"
        echo "npx @bubblewrap/cli build --generateAppBundle"
        echo ""
        echo "# For updates:"
        echo "npx @bubblewrap/cli update --manifest https://worklyindia.devs.surf/manifest.json"
        ;;
    *)
        echo -e "${RED}Invalid option${NC}"
        exit 1
        ;;
esac

echo ""
echo "=============================="
echo "📲 Next Steps"
echo "=============================="
echo ""
echo "1. Update public/.well-known/assetlinks.json with your SHA256 fingerprint"
echo "2. Deploy assetlinks.json to production"
echo "3. Test APK on your Android device"
echo "4. Upload AAB to Google Play Console"
echo ""
echo "For detailed instructions, see TWA_SETUP_GUIDE.md"
echo ""
