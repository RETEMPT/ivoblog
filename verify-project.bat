@echo off
chcp 65001 >nul 2>&1
cd /d "%~dp0"

node ivoblog\scripts\verify-project.mjs %*
if errorlevel 1 (
    echo.
    echo verify-project failed
    exit /b 1
)
