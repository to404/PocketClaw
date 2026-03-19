@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul 2>&1

set "SCRIPT_DIR=%~dp0"
set "BASE_DIR=%SCRIPT_DIR%..\"
set "VERSION_FILE=%BASE_DIR%version.txt"
set "BACKUP_DIR=%BASE_DIR%data\backups"
set "GITHUB_REPO=Austin5925/PocketClaw"

echo [PocketClaw Update] === PocketClaw Update ===

:: Get current version
if exist "%VERSION_FILE%" (
    set /p CURRENT_VERSION=<"%VERSION_FILE%"
) else (
    set "CURRENT_VERSION=0.0.0"
)
echo [PocketClaw Update] Current version: v%CURRENT_VERSION%

:: Check latest version
echo [PocketClaw Update] Checking for updates...
set "TMPFILE=%TEMP%\pocketclaw-latest.json"
curl -sfL "https://api.github.com/repos/%GITHUB_REPO%/releases/latest" -o "%TMPFILE%"
if errorlevel 1 (
    echo [ERROR] Could not check for updates. Check your network connection.
    pause
    exit /b 1
)

for /f "tokens=2 delims=:" %%a in ('findstr "tag_name" "%TMPFILE%"') do (
    set "LATEST_RAW=%%a"
)
set "LATEST_VERSION=%LATEST_RAW:~3,-2%"
del "%TMPFILE%" 2>nul
echo [PocketClaw Update] Latest version: v%LATEST_VERSION%

if "%CURRENT_VERSION%"=="%LATEST_VERSION%" (
    echo [PocketClaw Update] Already up to date!
    pause
    exit /b 0
)

echo [PocketClaw Update] Update available: v%CURRENT_VERSION% -^> v%LATEST_VERSION%

:: Backup
echo [PocketClaw Update] Backing up current version...
set "TIMESTAMP=%DATE:~0,4%%DATE:~5,2%%DATE:~8,2%"
mkdir "%BACKUP_DIR%\app-%CURRENT_VERSION%-%TIMESTAMP%" 2>nul
xcopy /E /I /Y "%BASE_DIR%app" "%BACKUP_DIR%\app-%CURRENT_VERSION%-%TIMESTAMP%\app\" >nul 2>nul

:: Download
echo [PocketClaw Update] Downloading update...
set "UPDATE_URL=https://github.com/%GITHUB_REPO%/releases/download/v%LATEST_VERSION%/PocketClaw-v%LATEST_VERSION%-update.tar.gz"
set "UPDATE_FILE=%TEMP%\pocketclaw-update.tar.gz"
curl -fSL "%UPDATE_URL%" -o "%UPDATE_FILE%"
if errorlevel 1 (
    echo [ERROR] Download failed
    pause
    exit /b 1
)

:: Extract
echo [PocketClaw Update] Extracting update...
tar -xzf "%UPDATE_FILE%" -C "%BASE_DIR%app" 2>nul
del "%UPDATE_FILE%" 2>nul

:: Update version
echo %LATEST_VERSION%> "%VERSION_FILE%"

:: Run migration
set "NODE_BIN=%BASE_DIR%app\runtime\node-win-x64\node.exe"
set "MIGRATE=%SCRIPT_DIR%migrate.js"
if exist "%NODE_BIN%" if exist "%MIGRATE%" (
    echo [PocketClaw Update] Running migration...
    "%NODE_BIN%" "%MIGRATE%" "%BASE_DIR%"
)

echo [PocketClaw Update] === Update Complete ===
echo [PocketClaw Update] Please restart PocketClaw to apply the update.
pause
