@echo off
title XINIA GANG ADMIN
cd /d "%~dp0"

:: 1. Check if Node.js is installed
where node >nul 2>nul
if %errorlevel% equ 0 goto RUN_APP

echo ======================================================================
echo  [*] Node.js is not found on this computer.
echo  [*] Auto-installing Node.js LTS, please wait...
echo ======================================================================
echo.

:: Try winget first if available
where winget >nul 2>nul
if %errorlevel% equ 0 (
    echo [*] Downloading and installing Node.js via Windows Package Manager...
    winget install OpenJS.NodeJS.LTS --silent --accept-package-agreements --accept-source-agreements
    goto RECHECK_NODE
)

:: Otherwise download official MSI using PowerShell
echo [*] Downloading official Node.js installer...
powershell -NoProfile -ExecutionPolicy Bypass -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; $url = 'https://nodejs.org/dist/v20.18.0/node-v20.18.0-x64.msi'; $out = Join-Path $env:TEMP 'node_setup.msi'; Write-Host 'Downloading Node.js...'; Invoke-WebRequest -Uri $url -OutFile $out; Start-Process msiexec.exe -ArgumentList '/i', $out, '/passive' -Wait; Remove-Item $out -Force -ErrorAction SilentlyContinue"

:RECHECK_NODE
:: Refresh PATH in current cmd session
set "PATH=%ProgramFiles%\nodejs;%ProgramFiles(x86)%\nodejs;%LOCALAPPDATA%\Programs\node;%APPDATA%\npm;%PATH%"

where node >nul 2>nul
if %errorlevel% equ 0 (
    echo.
    echo [OK] Node.js installed successfully!
    echo.
    goto RUN_APP
)

echo.
echo [!] Node.js installation finished. If it does not start automatically,
echo     please close this window and double-click START_ADMIN.bat again.
echo.
pause
exit /b 1

:RUN_APP
node admin-runner.js
if %errorlevel% neq 0 (
    echo.
    echo [!] Node.js execution ended.
    pause
)
