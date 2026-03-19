@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul 2>&1

set "SCRIPT_DIR=%~dp0"

:menu
cls
echo ╔══════════════════════════════════════╗
echo ║        PocketClaw 管理菜单           ║
echo ╠══════════════════════════════════════╣
echo ║  1. 启动PocketClaw                  ║
echo ║  2. 检查更新                         ║
echo ║  3. 重新初始化 (setup)               ║
echo ║  4. 查看版本信息                     ║
echo ║  5. 打开数据目录                     ║
echo ║  0. 退出                             ║
echo ╚══════════════════════════════════════╝
echo.
set /p choice=请选择 [0-5]:

if "%choice%"=="1" (
    echo 正在启动...
    call "%SCRIPT_DIR%Windows-Start.bat"
    goto :menu
)
if "%choice%"=="2" (
    echo 正在检查更新...
    call "%SCRIPT_DIR%system\update.bat"
    echo.
    pause
    goto :menu
)
if "%choice%"=="3" (
    echo 正在重新初始化...
    call "%SCRIPT_DIR%system\setup.bat"
    echo.
    pause
    goto :menu
)
if "%choice%"=="4" (
    echo.
    set /p ver=<"%SCRIPT_DIR%version.txt"
    echo 产品版本: v!ver!
    echo 数据目录: %SCRIPT_DIR%data
    echo.
    pause
    goto :menu
)
if "%choice%"=="5" (
    explorer "%SCRIPT_DIR%data"
    goto :menu
)
if "%choice%"=="0" (
    echo 再见！
    exit /b 0
)

echo 无效选项，请重试
timeout /t 1 /nobreak >nul
goto :menu
