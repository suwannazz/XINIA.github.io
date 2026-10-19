@echo off
title FiveM Gang Web - Cloudflare Quick Tunnel
echo ====================================================
echo  Starting FiveM Gang Web & Cloudflare Quick Tunnel
echo ====================================================
echo.

:: Check and start Node server if not running
netstat -ano | findstr :3000 >nul
if %errorlevel% neq 0 (
    echo [1/2] Starting Node.js backend server...
    start "" /b node server.js
    timeout /t 2 /nobreak >nul
) else (
    echo [1/2] Node.js server is already active on port 3000.
)

echo [2/2] Requesting Temporary Cloudflare HTTPS Tunnel...
echo.
echo ====================================================
echo  Your Temporary Public Cloudflare URL will show below:
echo ====================================================
cloudflared tunnel --url http://localhost:3000
pause
