@echo off
title XINIA GANG ADMIN
cd /d "%~dp0"
node admin-runner.js
if %errorlevel% neq 0 (
    echo.
    echo [!] Node.js execution ended.
    pause
)
