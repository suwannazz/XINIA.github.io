@echo off
title XINIA GANG ADMIN
cd /d "%~dp0"
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed on this computer!
    echo Please download and install Node.js from: https://nodejs.org/
    echo.
    pause
    exit /b 1
)
node admin-runner.js
if %errorlevel% neq 0 (
    echo.
    echo [!] Node.js execution ended.
    pause
)
