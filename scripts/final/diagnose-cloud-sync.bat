@echo off
setlocal EnableDelayedExpansion
chcp 65001 >nul 2>&1

cd /d "%~dp0\..\.."
if "%M3E_HOME%"=="" set "M3E_HOME=%LOCALAPPDATA%\M3E"
set "CONFIG_FILE=%M3E_HOME%\m3e.conf"
set "LOG_FILE=%M3E_HOME%\launch.log"

echo === M3E Final Cloud Sync Diagnosis ===
echo M3E_HOME=%M3E_HOME%
echo CONFIG_FILE=%CONFIG_FILE%
echo.

if exist "%CONFIG_FILE%" (
  echo [config] m3e.conf
  type "%CONFIG_FILE%"
) else (
  echo [config] m3e.conf not found
)

echo.
echo [env] active M3E_* overrides
set M3E_

echo.
echo [checks]
if "%M3E_HOME%"=="" echo - ERROR: M3E_HOME is empty
if exist "%LOG_FILE%" (
  echo - launch.log exists: %LOG_FILE%
) else (
  echo - launch.log missing: %LOG_FILE%
)
if exist "%LOCALAPPDATA%\M3E\workspaces" (
  echo - workspaces dir exists: %LOCALAPPDATA%\M3E\workspaces
) else (
  echo - workspaces dir missing: %LOCALAPPDATA%\M3E\workspaces
)

echo.
echo [notes]
echo - Home screen map list is local SQLite. It is not the shared cloud index.
echo - Shared sync applies per map via Pull/Push (or Auto Sync if enabled).
echo - If two PCs show different Home contents, that alone does not prove cloud sync is broken.

echo.
if exist "%LOG_FILE%" (
  echo [tail] launch.log
  powershell -NoProfile -Command "Get-Content '%LOG_FILE%' -Tail 80"
) else (
  echo [tail] launch.log unavailable
)

exit /b 0
