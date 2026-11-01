@echo off
setlocal
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0eventsss-main\scripts\maintenance\repair-publiclanding.ps1"
if errorlevel 1 (
  echo.
  echo Repair/validation failed.
  pause
  exit /b 1
)
echo.
echo Repair completed successfully.
pause
