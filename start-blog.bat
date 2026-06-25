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
echo   Preferred URL: http://localhost:3000
echo   Open the URL manually when ready
echo   Close this window to stop
echo ==========================================

set "BLOG_PORT="
for /f %%P in ('powershell -NoProfile -Command "$ports = @(3000) + (3020..3039); foreach ($p in $ports) { $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Parse('127.0.0.1'), $p); try { $listener.Start(); $listener.Stop(); Write-Output $p; break } catch { } }"') do set "BLOG_PORT=%%P"

if not defined BLOG_PORT (
    echo Error: No available frontend port in 3000 or 3020-3039
    pause
    exit /b 1
)

if not "%BLOG_PORT%"=="3000" (
    echo Port 3000 is busy; using http://127.0.0.1:%BLOG_PORT%
) else (
    echo Using http://127.0.0.1:%BLOG_PORT%
)

call npm run dev -- --hostname 127.0.0.1 --port %BLOG_PORT%
pause
