@echo off
chcp 65001 >nul 2>&1
cd /d "%~dp0ivoblog\my-blog-manager"
if not exist "run_me.py" (
    echo Error: Cannot find manager directory
    pause
    exit /b
)
echo ==========================================
echo   iV0 Blog - Manager
echo   Preferred URL: http://localhost:3001/settings
echo   If that port is busy, the launcher prints the actual URL
echo   Desktop manager window opens; browser will not open automatically
echo   Close this window to stop
echo ==========================================

python run_me.py
pause
