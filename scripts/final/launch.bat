@echo off
setlocal

REM ============================================================
REM M3E Final launch script
REM - Daily startup entry point
REM - Use migrate-from-beta.bat for update/migration
REM ============================================================

cd /d "%~dp0\..\.."

REM Final environment stores user data outside app directory by default.
if "%M3E_DATA_DIR%"=="" set "M3E_DATA_DIR=%APPDATA%\M3E"
if not exist "%M3E_DATA_DIR%" mkdir "%M3E_DATA_DIR%"
if "%M3E_PORT%"=="" set "M3E_PORT=38482"

REM Stop stale server process if configured port is already in use.
for /f "tokens=5" %%P in ('netstat -ano ^| findstr :%M3E_PORT% ^| findstr LISTENING') do (
  if not "%%P"=="0" (
    echo Stopping existing process on port %M3E_PORT% ^(PID %%P^)...
    taskkill /PID %%P /F >nul 2>&1
  )
)

call npm --prefix final start

if errorlevel 1 (
  echo.
  echo [ERROR] Launch failed.
  echo   Run migrate-from-beta.bat first for initial setup.
  pause
  exit /b 1
)

exit /b 0
