@echo off
title TM Hub
cd /d "%~dp0"
echo Starting TM Hub. Keep this window open so the 11 AM, 5 PM and 8 PM emails go out.
set OPEN_BROWSER=1
node server.js
pause
