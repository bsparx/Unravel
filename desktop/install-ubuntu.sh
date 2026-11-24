#!/usr/bin/env bash
set -euo pipefail

# Install Unravel Desktop Companion into the current Ubuntu user's desktop environment.
# Zero sudo, zero pip/apt installs, zero database credentials.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BIN_DIR="$HOME/.local/bin"
APPS_DIR="$HOME/.local/share/applications"
ICON_DIR="$HOME/.local/share/icons/hicolor/scalable/apps"
AUTOSTART_DIR="$HOME/.config/autostart"

ENABLE_AUTOSTART=false
if [[ "${1:-}" == "--autostart" ]]; then
  ENABLE_AUTOSTART=true
fi

mkdir -p "$BIN_DIR" "$APPS_DIR" "$ICON_DIR"

# 1. Executable launcher script
cat > "$BIN_DIR/unravel-desktop" <<EOF
#!/usr/bin/env bash
export PYTHONPATH="$SCRIPT_DIR\${PYTHONPATH:+:\$PYTHONPATH}"
exec python3 -m unravel_desktop "\$@"
EOF
chmod +x "$BIN_DIR/unravel-desktop"

# 2. Scalable SVG icon
cp "$SCRIPT_DIR/assets/unravel.svg" "$ICON_DIR/unravel-desktop.svg"

# 3. GNOME Applications menu entry
cat > "$APPS_DIR/unravel-desktop.desktop" <<EOF
[Desktop Entry]
Type=Application
Name=Unravel
GenericName=Pomodoro Timer & Statistics
Comment=Lightweight Unravel desktop companion synced with your Unravel account
Exec=$BIN_DIR/unravel-desktop
Icon=unravel-desktop
Terminal=false
Categories=Utility;Office;Clock;
StartupWMClass=app.unravel.Desktop
StartupNotify=true
EOF

# 4. Optional login autostart (also toggleable inside the app's Settings)
if [[ "$ENABLE_AUTOSTART" == "true" ]]; then
  mkdir -p "$AUTOSTART_DIR"
  cat > "$AUTOSTART_DIR/unravel-desktop.desktop" <<EOF
[Desktop Entry]
Type=Application
Name=Unravel
Comment=Unravel Pomodoro timer and statistics companion
Exec=$BIN_DIR/unravel-desktop --minimized
Icon=unravel-desktop
Terminal=false
X-GNOME-Autostart-enabled=true
EOF
fi

if command -v update-desktop-database >/dev/null 2>&1; then
  update-desktop-database "$APPS_DIR" >/dev/null 2>&1 || true
fi
if command -v gtk-update-icon-cache >/dev/null 2>&1; then
  gtk-update-icon-cache -f -t "$HOME/.local/share/icons/hicolor" >/dev/null 2>&1 || true
fi

echo "Installed Unravel Desktop Companion:"
echo "  Command:  $BIN_DIR/unravel-desktop"
echo "  Launcher: $APPS_DIR/unravel-desktop.desktop"
echo "  Icon:     $ICON_DIR/unravel-desktop.svg"
if [[ "$ENABLE_AUTOSTART" == "true" ]]; then
  echo "  Autostart: $AUTOSTART_DIR/unravel-desktop.desktop"
fi
echo ""
echo "Launch from Ubuntu Activities ('Unravel') or run: $BIN_DIR/unravel-desktop"
