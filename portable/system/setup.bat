@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul 2>&1

set "SCRIPT_DIR=%~dp0"
set "BASE_DIR=%SCRIPT_DIR%..\"
set "RUNTIME_DIR=%BASE_DIR%app\runtime"
set "CORE_DIR=%BASE_DIR%app\core"
set "NODE_VERSION=22.22.1"
set "OPENCLAW_VERSION=2026.3.28"
set "NODE_SHA256=877cb93829e14fffbbc7903e7d8037336c9a79f3ea43c5d0b8c2379b79da56de"

echo [OpenClawU盘便携版] === OpenClawU盘便携版 Setup ===

if "%~1"=="openclaw" goto :install_openclaw
if "%~1"=="node" goto :download_node
if "%~1"=="control-ui" goto :build_control_ui
goto :setup_all

:setup_all
call :download_node
call :install_openclaw
call :setup_data
goto :done

:download_node
set "NODE_DIR=%RUNTIME_DIR%\node-win-x64"
if exist "%NODE_DIR%\node.exe" (
    echo [OpenClawU盘便携版] Node.js already exists, skipping
    goto :eof
)

echo [OpenClawU盘便携版] Downloading Node.js v%NODE_VERSION% for Windows x64...
mkdir "%NODE_DIR%" 2>nul

set "NODE_URL=https://nodejs.org/dist/v%NODE_VERSION%/node-v%NODE_VERSION%-win-x64.zip"
set "TMPZIP=%TEMP%\node-win-x64.zip"

curl -fSL "%NODE_URL%" -o "%TMPZIP%"
if errorlevel 1 (
    echo [ERROR] Failed to download Node.js
    exit /b 1
)

echo [OpenClawU盘便携版] Verifying SHA256...
for /f "skip=1 tokens=*" %%h in ('certutil -hashfile "%TMPZIP%" SHA256') do (
    if not defined ACTUAL_HASH set "ACTUAL_HASH=%%h"
)
if /i not "%ACTUAL_HASH%"=="%NODE_SHA256%" (
    echo [ERROR] SHA256 verification failed
    echo   Expected: %NODE_SHA256%
    echo   Got:      %ACTUAL_HASH%
    del "%TMPZIP%"
    exit /b 1
)
echo [OpenClawU盘便携版] SHA256 verified

powershell -Command "Expand-Archive -Path '%TMPZIP%' -DestinationPath '%TEMP%\node-extract' -Force"
xcopy /E /I /Y "%TEMP%\node-extract\node-v%NODE_VERSION%-win-x64\*" "%NODE_DIR%\"
rd /S /Q "%TEMP%\node-extract"
del "%TMPZIP%"

echo [OpenClawU盘便携版] Node.js downloaded successfully
goto :eof

:install_openclaw
set "NODE_BIN=%RUNTIME_DIR%\node-win-x64\node.exe"
set "NPM_BIN=%RUNTIME_DIR%\node-win-x64\node_modules\npm\bin\npm-cli.js"

if not exist "%NODE_BIN%" (
    echo [ERROR] Node.js not found. Run setup first with: setup.bat node
    exit /b 1
)

echo [OpenClawU盘便携版] Installing OpenClaw v%OPENCLAW_VERSION% + QQ/WeChat channel plugins...
mkdir "%CORE_DIR%" 2>nul

pushd "%CORE_DIR%"
"%NODE_BIN%" "%NPM_BIN%" install
if errorlevel 1 (
    echo [OpenClawU盘便携版] Retrying npm install with --ignore-scripts ^(QQ/WeChat plugin postinstall may fail on cmd^)...
    "%NODE_BIN%" "%NPM_BIN%" install --ignore-scripts
    if errorlevel 1 (
        popd
        echo [ERROR] Failed to install OpenClaw / channel plugins
        exit /b 1
    )
)
REM Plugins resolve host version from nearest package.json — align with openclaw
"%NODE_BIN%" -e "const fs=require('fs'),path=require('path');const d=process.cwd();const pj=path.join(d,'package.json');const p=require(pj);try{p.version=require(path.join(d,'node_modules/openclaw/package.json')).version;fs.writeFileSync(pj,JSON.stringify(p,null,2));}catch(e){}"
popd

echo [OpenClawU盘便携版] OpenClaw and channel plugins installed successfully
if not exist "%BASE_DIR%dist\control-ui\index.html" (
    echo [OpenClawU盘便携版] NOTE: Gateway Control UI ^(18789^) assets are missing. Official zips include them.
    echo [OpenClawU盘便携版]       From repo clone: install Git + pnpm, then run  setup.bat control-ui
)
goto :eof

:build_control_ui
echo [OpenClawU盘便携版] Building Control UI ^(port 18789^) — requires Git + pnpm on PATH...
set "BUILD_UI_SCRIPT=%BASE_DIR%..\scripts\build-control-ui.ps1"
if not exist "%BUILD_UI_SCRIPT%" (
    echo [ERROR] Missing scripts\build-control-ui.ps1
    exit /b 1
)
powershell -NoProfile -ExecutionPolicy Bypass -File "%BUILD_UI_SCRIPT%"
if errorlevel 1 (
    echo [ERROR] Control UI build failed. Install Git and pnpm ^(npm install -g pnpm^), then retry: setup.bat control-ui
    exit /b 1
)
echo [OpenClawU盘便携版] Control UI ready at portable\dist\control-ui\
goto :eof

:setup_data
echo [OpenClawU盘便携版] Setting up data directories...
mkdir "%BASE_DIR%data\.openclaw" 2>nul
mkdir "%BASE_DIR%data\memory" 2>nul
mkdir "%BASE_DIR%data\backups" 2>nul

if not exist "%BASE_DIR%data\.openclaw\openclaw.json" (
    echo {}> "%BASE_DIR%data\.openclaw\openclaw.json"
)
echo [OpenClawU盘便携版] Data directories ready
goto :eof

:done
echo [OpenClawU盘便携版] === Setup Complete ===
endlocal
