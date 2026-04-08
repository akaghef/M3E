#!/bin/bash
set -euo pipefail

# ============================================================
#  M3E Installer (macOS / Linux)
#  - Downloads portable Node.js automatically (no pre-install needed)
#  - Builds the app and creates a launch shortcut
# ============================================================

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
INSTALL_DIR="$ROOT_DIR/install"
ASSETS_DIR="$INSTALL_DIR/assets"
NODE_VERSION="22.14.0"

echo ""
echo "  ============================================="
echo "   M3E Setup"
echo "  ============================================="
echo ""

# ============================================================
#  Step 1 — Ensure Node.js is available
# ============================================================

NODE_EXE=""
NPM_CMD=""

# Check for portable Node.js first
if [[ -x "$INSTALL_DIR/node/bin/node" ]]; then
  echo "  Portable Node.js found."
  NODE_EXE="$INSTALL_DIR/node/bin/node"
  NPM_CMD="$INSTALL_DIR/node/bin/npm"
elif command -v node >/dev/null 2>&1; then
  SYS_NODE_VER="$(node --version)"
  echo "  System Node.js $SYS_NODE_VER found."
  NODE_EXE="$(command -v node)"
  NPM_CMD="$(command -v npm)"
else
  echo "  Node.js not found. Downloading portable Node.js $NODE_VERSION..."
  echo ""

  # Detect platform
  UNAME_S="$(uname -s)"
  UNAME_M="$(uname -m)"

  case "$UNAME_S" in
    Darwin)
      case "$UNAME_M" in
        arm64) PLATFORM="darwin-arm64" ;;
        *)     PLATFORM="darwin-x64" ;;
      esac
      ;;
    Linux)
      case "$UNAME_M" in
        aarch64) PLATFORM="linux-arm64" ;;
        *)       PLATFORM="linux-x64" ;;
      esac
      ;;
    *)
      echo "  [ERROR] Unsupported OS: $UNAME_S"
      exit 1
      ;;
  esac

  NODE_TARBALL="node-v${NODE_VERSION}-${PLATFORM}.tar.gz"
  NODE_URL="https://nodejs.org/dist/v${NODE_VERSION}/${NODE_TARBALL}"
  TMP_FILE="$(mktemp)"

  # Download
  if command -v curl >/dev/null 2>&1; then
    curl -fSL --progress-bar "$NODE_URL" -o "$TMP_FILE"
  elif command -v wget >/dev/null 2>&1; then
    wget -q --show-progress "$NODE_URL" -O "$TMP_FILE"
  else
    echo "  [ERROR] curl or wget is required."
    exit 1
  fi

  echo "  Download complete. Extracting..."

  # Extract to install/node/
  rm -rf "$INSTALL_DIR/node"
  mkdir -p "$INSTALL_DIR/node"
  tar -xzf "$TMP_FILE" -C "$INSTALL_DIR/node" --strip-components=1
  rm -f "$TMP_FILE"

  echo "  Node.js $NODE_VERSION installed to install/node/"

  NODE_EXE="$INSTALL_DIR/node/bin/node"
  NPM_CMD="$INSTALL_DIR/node/bin/npm"
fi

echo ""

# ============================================================
#  Step 2 — Ask for data save location
# ============================================================

if [[ "$(uname -s)" == "Darwin" ]]; then
  DEFAULT_DATA_DIR="$HOME/Library/Application Support/M3E"
else
  DEFAULT_DATA_DIR="${XDG_DATA_HOME:-$HOME/.local/share}/M3E"
fi

echo "  Where would you like to save your M3E data?"
echo "  (This is where your database file will be stored.)"
echo ""
echo "  Press Enter to use the default location,"
echo "  or type a custom path:"
echo ""
echo "    Default: $DEFAULT_DATA_DIR"
echo ""
read -r -p "  Path (or Enter for default): " USER_DATA_DIR

if [[ -z "$USER_DATA_DIR" ]]; then
  M3E_DATA_DIR="$DEFAULT_DATA_DIR"
else
  M3E_DATA_DIR="$USER_DATA_DIR"
fi

echo ""
echo "  Save location: $M3E_DATA_DIR"

mkdir -p "$M3E_DATA_DIR"

# ============================================================
#  Step 2.5 — Copy tutorial data if first install
# ============================================================

TUTORIAL_SRC="$ASSETS_DIR/tutorial"
if [[ -d "$TUTORIAL_SRC" ]] && [[ -n "$(ls -A "$TUTORIAL_SRC" 2>/dev/null)" ]]; then
  if [[ ! -f "$M3E_DATA_DIR/m3e.db" ]]; then
    echo "  Copying tutorial data..."
    cp -r "$TUTORIAL_SRC/"* "$M3E_DATA_DIR/" 2>/dev/null || true
    echo "  Tutorial data installed."
  else
    echo "  Existing data found. Skipping tutorial data."
  fi
fi

# ============================================================
#  Step 3 — Save config
# ============================================================

if [[ "$(uname -s)" == "Darwin" ]]; then
  CONFIG_DIR="$HOME/Library/Application Support/M3E"
else
  CONFIG_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/M3E"
fi
CONFIG_FILE="$CONFIG_DIR/m3e.conf"
mkdir -p "$CONFIG_DIR"

cat > "$CONFIG_FILE" <<EOF
M3E_DATA_DIR=$M3E_DATA_DIR
M3E_PORT=38482
M3E_ROOT=$ROOT_DIR
EOF

echo "  Config saved to: $CONFIG_FILE"

# ============================================================
#  Step 4 — Install dependencies & build
# ============================================================

echo ""
echo "  [1/2] Installing dependencies..."
if ! "$NPM_CMD" --prefix "$ROOT_DIR/final" ci 2>/dev/null; then
  echo ""
  echo "  npm ci failed. Trying npm install..."
  "$NPM_CMD" --prefix "$ROOT_DIR/final" install
fi
echo "  Dependencies installed."

echo ""
echo "  [2/2] Building M3E..."
"$NPM_CMD" --prefix "$ROOT_DIR/final" run build
echo "  Build complete."

# ============================================================
#  Step 5 — Create launch shortcut
# ============================================================

echo ""
LAUNCH_SCRIPT="$ROOT_DIR/scripts/final/launch.sh"
chmod +x "$LAUNCH_SCRIPT" 2>/dev/null || true

if [[ "$(uname -s)" == "Darwin" ]]; then
  # Create macOS .app bundle
  APP_DIR="$HOME/Desktop/M3E.app"
  APP_CONTENTS="$APP_DIR/Contents"
  APP_MACOS="$APP_CONTENTS/MacOS"
  APP_RESOURCES="$APP_CONTENTS/Resources"

  mkdir -p "$APP_MACOS" "$APP_RESOURCES"

  # Info.plist
  cat > "$APP_CONTENTS/Info.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleName</key>
  <string>M3E</string>
  <key>CFBundleDisplayName</key>
  <string>M3E</string>
  <key>CFBundleIdentifier</key>
  <string>com.m3e.viewer</string>
  <key>CFBundleVersion</key>
  <string>0.1.0</string>
  <key>CFBundleExecutable</key>
  <string>launch</string>
  <key>CFBundleIconFile</key>
  <string>icon</string>
  <key>CFBundlePackageType</key>
  <string>APPL</string>
</dict>
</plist>
PLIST

  # Launcher script inside .app
  cat > "$APP_MACOS/launch" <<LAUNCHER
#!/bin/bash
exec "$LAUNCH_SCRIPT"
LAUNCHER
  chmod +x "$APP_MACOS/launch"

  # Convert icon for macOS (JPG -> icns via sips)
  if [[ -f "$ASSETS_DIR/image.jpg" ]]; then
    echo "  Converting app icon..."
    ICONSET_DIR="$(mktemp -d)/M3E.iconset"
    mkdir -p "$ICONSET_DIR"

    # Generate required icon sizes
    for SIZE in 16 32 64 128 256 512; do
      sips -z $SIZE $SIZE "$ASSETS_DIR/image.jpg" --out "$ICONSET_DIR/icon_${SIZE}x${SIZE}.png" >/dev/null 2>&1 || true
    done
    for SIZE in 32 64 128 256 512 1024; do
      HALF=$((SIZE / 2))
      if [[ -f "$ICONSET_DIR/icon_${HALF}x${HALF}.png" ]]; then
        cp "$ICONSET_DIR/icon_${HALF}x${HALF}.png" "$ICONSET_DIR/icon_${HALF}x${HALF}@2x.png" 2>/dev/null || true
      fi
      sips -z $SIZE $SIZE "$ASSETS_DIR/image.jpg" --out "$ICONSET_DIR/icon_${HALF}x${HALF}@2x.png" >/dev/null 2>&1 || true
    done

    if iconutil -c icns "$ICONSET_DIR" -o "$APP_RESOURCES/icon.icns" 2>/dev/null; then
      echo "  Icon created."
    else
      echo "  [WARN] Icon conversion failed. App will use default icon."
    fi
    rm -rf "$(dirname "$ICONSET_DIR")"
  fi

  echo "  macOS app created: ~/Desktop/M3E.app"

else
  # Linux: create .desktop file
  DESKTOP_FILE="$HOME/Desktop/M3E.desktop"
  cat > "$DESKTOP_FILE" <<DESKTOP
[Desktop Entry]
Name=M3E
Comment=M3E Viewer
Exec=$LAUNCH_SCRIPT
Terminal=false
Type=Application
Categories=Utility;
DESKTOP

  # Convert icon for Linux (JPG -> PNG)
  ICON_PNG="$ASSETS_DIR/icon.png"
  if [[ -f "$ASSETS_DIR/image.jpg" ]] && command -v convert >/dev/null 2>&1; then
    convert "$ASSETS_DIR/image.jpg" -resize 256x256 "$ICON_PNG" 2>/dev/null || true
  fi
  if [[ -f "$ICON_PNG" ]]; then
    echo "Icon=$ICON_PNG" >> "$DESKTOP_FILE"
  fi

  chmod +x "$DESKTOP_FILE" 2>/dev/null || true
  echo "  Desktop shortcut created: ~/Desktop/M3E.desktop"
fi

# ============================================================
#  Done
# ============================================================

echo ""
echo "  ============================================="
echo "   Setup Complete!"
echo "  ============================================="
echo ""
echo "  Data location : $M3E_DATA_DIR"
if [[ "$(uname -s)" == "Darwin" ]]; then
  echo "  Launch        : Double-click M3E.app on your Desktop"
else
  echo "  Launch        : Double-click M3E on your Desktop"
fi
echo ""
read -r -p "  Launch M3E now? [Y/n]: " LAUNCH_NOW
if [[ "${LAUNCH_NOW,,}" != "n" ]]; then
  exec "$LAUNCH_SCRIPT"
fi
