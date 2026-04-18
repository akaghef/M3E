@echo off
setlocal EnableDelayedExpansion

REM Configure the standard Final launcher back to local personal mode.

if "%M3E_HOME%"=="" set "M3E_HOME=%LOCALAPPDATA%\M3E"
if not exist "%M3E_HOME%" mkdir "%M3E_HOME%" >nul 2>&1

set "CONFIG_FILE=%M3E_HOME%\m3e.conf"

powershell -NoProfile -Command ^
  "$p = '%CONFIG_FILE%';" ^
  "$content = @();" ^
  "if (Test-Path $p) { $content = Get-Content $p | Where-Object { $_ -notmatch '^(M3E_LAUNCH_MODE|M3E_SWINGBY_BASE_URL|M3E_SWINGBY_WORKSPACE_ID|M3E_SWINGBY_MAP_ID)=' } };" ^
  "$content += 'M3E_LAUNCH_MODE=personal';" ^
  "Set-Content -Path $p -Value $content -Encoding UTF8"

if errorlevel 1 (
  echo [swingby-config] ERROR: failed to write %CONFIG_FILE%
  exit /b 1
)

echo [swingby-config] Final launcher mode set to personal.
echo [swingby-config] Config file: %CONFIG_FILE%
exit /b 0
