@echo off
setlocal EnableDelayedExpansion

REM ============================================================
REM M3E Final launch script
REM - Daily startup entry point
REM - Use install.bat for first-time setup
REM - Use migrate-from-beta.bat for update/migration
REM ============================================================

cd /d "%~dp0\..\.."

REM Load saved config (written by install.bat), then apply env overrides.
set "CONFIG_FILE=%APPDATA%\M3E\m3e.conf"
if exist "%CONFIG_FILE%" (
  for /f "usebackq tokens=1,* delims==" %%A in ("%CONFIG_FILE%") do (
    if "%%A"=="M3E_DATA_DIR" if "!M3E_DATA_DIR!"=="" set "M3E_DATA_DIR=%%B"
    if "%%A"=="M3E_PORT"     if "!M3E_PORT!"==""     set "M3E_PORT=%%B"
  )
)

REM Final fallback defaults.
if "!M3E_DATA_DIR!"=="" set "M3E_DATA_DIR=%APPDATA%\M3E"
if "!M3E_PORT!"==""     set "M3E_PORT=38482"
if not exist "!M3E_DATA_DIR!" mkdir "!M3E_DATA_DIR!"

REM Stop stale server process if configured port is already in use.
for /f "tokens=5" %%P in ('netstat -ano ^| findstr :!M3E_PORT! ^| findstr LISTENING') do (
  if not "%%P"=="0" (
    echo Stopping existing process on port !M3E_PORT! ^(PID %%P^)...
    taskkill /PID %%P /F >nul 2>&1
  )
)

set "M3E_DATA_DIR=!M3E_DATA_DIR!"
set "M3E_PORT=!M3E_PORT!"
call npm --prefix final start

if errorlevel 1 (
  echo.
  echo [ERROR] Launch failed.
  echo   Run install.bat for first-time setup.
  pause
  exit /b 1
)

exit /b 0
