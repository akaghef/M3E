@echo off
setlocal EnableDelayedExpansion
chcp 65001 >nul 2>&1

REM ============================================================
REM M3E Final launch script
REM - Daily startup entry point
REM - Use setup.bat for first-time setup
REM ============================================================

cd /d "%~dp0\..\.."
set "ROOT=%cd%"

REM Load saved config (written by setup.bat), then apply env overrides.
set "CONFIG_FILE=%LOCALAPPDATA%\M3E\m3e.conf"
if exist "%CONFIG_FILE%" (
  for /f "usebackq tokens=1,* delims==" %%A in ("%CONFIG_FILE%") do (
    if "%%A"=="M3E_DATA_DIR" if "!M3E_DATA_DIR!"=="" set "M3E_DATA_DIR=%%B"
    if "%%A"=="M3E_PORT"     if "!M3E_PORT!"==""     set "M3E_PORT=%%B"
  )
)

REM Final fallback defaults.
if "!M3E_DATA_DIR!"=="" set "M3E_DATA_DIR=%LOCALAPPDATA%\M3E"
if "!M3E_PORT!"==""     set "M3E_PORT=38482"
if not exist "!M3E_DATA_DIR!" mkdir "!M3E_DATA_DIR!"

REM Stop stale server process if configured port is already in use.
for /f "tokens=5" %%P in ('netstat -ano 2^>nul ^| findstr ":!M3E_PORT!" ^| findstr "LISTENING"') do (
  if not "%%P"=="0" (
    echo Stopping existing process on port !M3E_PORT! ^(PID %%P^)...
    taskkill /PID %%P /F >nul 2>&1
  )
)

REM Resolve Node/npm path
set "NODE_DIR=%ROOT%\install\node"
if exist "%NODE_DIR%\npm.cmd" (
  call "%NODE_DIR%\npm.cmd" --prefix "%ROOT%\final" start
) else (
  call npm --prefix "%ROOT%\final" start
)

if %ERRORLEVEL% neq 0 (
  echo.
  echo [ERROR] Launch failed.
  echo   Run install\setup.bat for first-time setup.
  pause
  exit /b 1
)

exit /b 0
