@echo off
setlocal
set ROOT=%~dp0
powershell -NoProfile -ExecutionPolicy Bypass -File "%ROOT%scripts\install_all.ps1"
if errorlevel 1 (
  echo.
  echo install_all failed.
  exit /b 1
)
echo.
echo install_all completed.
