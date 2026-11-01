@echo off
setlocal
set ROOT=%~dp0
set RAW=%~1
if "%RAW%"=="" set RAW=%ROOT%pipeline\input\corpus
powershell -NoProfile -ExecutionPolicy Bypass -File "%ROOT%scripts\run_pipeline.ps1" -RawRoot "%RAW%"
if errorlevel 1 (
  echo.
  echo run_pipeline failed.
  exit /b 1
)
echo.
echo run_pipeline completed.
