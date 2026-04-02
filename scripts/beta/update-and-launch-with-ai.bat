@echo off
setlocal

if "%~1"=="" (
  echo Usage: update-and-launch-with-ai.bat ^<bitwarden-item-id-or-name^>
  echo.
  echo Requires:
  echo   1. Bitwarden CLI ^(`bw`^) installed
  echo   2. `bw unlock` already run and BW_SESSION exported
  exit /b 1
)

pwsh -File "%~dp0launch-with-ai.ps1" -BitwardenItem "%~1" -Update
exit /b %errorlevel%
