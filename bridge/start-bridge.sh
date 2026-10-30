#!/usr/bin/env sh
# NostalgiaVue Bridge for macOS/Linux. Needs Python 3 and Tailscale.
cd "$(dirname "$0")"
tailscale serve --bg 8787 >/dev/null 2>&1 || echo "Run 'tailscale serve --bg 8787' once to get an https address."
exec python3 nostalgiavue_bridge.py
