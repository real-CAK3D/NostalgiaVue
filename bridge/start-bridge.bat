@echo off
REM NostalgiaVue Bridge for Windows. Needs Python 3 (python.org) and Tailscale.
cd /d "%~dp0"
start "" tailscale serve --bg 8787
python nostalgiavue_bridge.py
pause
