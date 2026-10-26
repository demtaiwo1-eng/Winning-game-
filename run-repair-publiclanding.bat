@echo off
setlocal
powershell -ExecutionPolicy Bypass -File "%~dp0repair-publiclanding.ps1"
if errorlevel 1 (
  echo.
  echo Repair/validation failed.
  pause
  exit /b 1
)
echo.
echo Repair completed successfully.
pause
