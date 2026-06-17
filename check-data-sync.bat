@echo off
setlocal
cd /d "%~dp0"

node ivoblog\scripts\check-data-sync.mjs %*
if errorlevel 1 (
  echo.
  echo Data files are not in sync. To mirror manager data to the blog, run:
  echo check-data-sync.bat --write
)

pause
