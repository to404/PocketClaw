@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul 2>&1

set "SCRIPT_DIR=%~dp0"
set "APP_DIR=%SCRIPT_DIR%app"
set "DATA_DIR=%SCRIPT_DIR%data"
set "SYSTEM_DIR=%SCRIPT_DIR%system"
set "GATEWAY_PORT=18789"
set "UI_PORT=3210"

set "NODE_BIN=%APP_DIR%\runtime\node-win-x64\node.exe"
set "OPENCLAW_BIN=%APP_DIR%\core\node_modules\.bin\openclaw.cmd"

echo [PocketClaw] === PocketClaw ===

for /f "usebackq tokens=*" %%v in ("%SCRIPT_DIR%version.txt") do set "VERSION=%%v"
echo [PocketClaw] Version: %VERSION%

if not exist "%NODE_BIN%" (
    echo [PocketClaw ERROR] Node.js not found. Please run setup first:
    echo   %SYSTEM_DIR%\setup.bat
    pause
    exit /b 1
)

if not exist "%OPENCLAW_BIN%" (
    echo [PocketClaw ERROR] OpenClaw not found. Please run setup first:
    echo   %SYSTEM_DIR%\setup.bat
    pause
    exit /b 1
)

set "PATH=%APP_DIR%\runtime\node-win-x64;%PATH%"
set "OPENCLAW_HOME=%DATA_DIR%\.openclaw"

echo [PocketClaw] Starting OpenClaw Gateway on port %GATEWAY_PORT%...
start /b "" "%OPENCLAW_BIN%" gateway --port %GATEWAY_PORT%

echo [PocketClaw] Waiting for Gateway...
set "RETRIES=0"
:wait_gateway
timeout /t 1 /nobreak >nul
curl -sf "http://127.0.0.1:%GATEWAY_PORT%/health" >nul 2>&1
if errorlevel 1 (
    set /a RETRIES+=1
    if !RETRIES! gtr 30 (
        echo [PocketClaw ERROR] Gateway failed to start
        pause
        exit /b 1
    )
    goto :wait_gateway
)
echo [PocketClaw] Gateway started

echo [PocketClaw] Starting UI server on port %UI_PORT%...
start /b "" "%NODE_BIN%" "%SYSTEM_DIR%\server.js"
timeout /t 2 /nobreak >nul

echo [PocketClaw] Opening browser...
start http://localhost:%UI_PORT%

echo.
echo [PocketClaw] PocketClaw is running!
echo   UI:      http://localhost:%UI_PORT%
echo   Gateway: http://localhost:%GATEWAY_PORT%
echo.
echo Press Ctrl+C or close this window to stop
pause >nul
