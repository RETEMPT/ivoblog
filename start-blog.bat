@echo off
chcp 65001 >nul 2>&1
cd /d "%~dp0ivoblog\blog"
if not exist "package.json" (
    echo Error: Cannot find blog directory
    pause
    exit /b
)
echo ==========================================
echo   iV0 Blog - Frontend
echo   http://localhost:3000
echo   Open the URL manually when ready
echo   Close this window to stop
echo ==========================================

call npm run dev
pause
