@echo off
setlocal EnableExtensions

REM M3E Swingby shared server launcher.
REM Public access currently goes through Tailscale Funnel:
REM   https://akaghef-dell.tail6206ae.ts.net/viewer.html

cd /d "%~dp0\..\.."

set "M3E_HOME=%LOCALAPPDATA%\M3E"
set "M3E_PORT=4173"
set "M3E_WORKSPACE_ID=ws_team_swingby"
set "M3E_WORKSPACE_LABEL=Swingby Team"
set "M3E_MAP_ID=map_team_swingby_monthly_2604"
set "M3E_MAP_LABEL=定例会"
set "M3E_MAP_SLUG=swingby-monthly-2604"

set "M3E_CHANNEL=beta"
set "M3E_DATA_DIR=%M3E_HOME%\workspaces\%M3E_WORKSPACE_ID%"
set "M3E_DB_FILE=data.sqlite"
set "M3E_DOC_ID=%M3E_MAP_ID%"
set "M3E_CLOUD_SYNC=0"
set "M3E_AUTO_SYNC=0"
set "M3E_AI_ENABLED=0"

if not exist "%M3E_DATA_DIR%" mkdir "%M3E_DATA_DIR%" >nul 2>&1

echo [swingby] M3E_DATA_DIR=%M3E_DATA_DIR%
echo [swingby] M3E_WORKSPACE=%M3E_WORKSPACE_LABEL% ^(%M3E_WORKSPACE_ID%^)
echo [swingby] M3E_MAP=%M3E_MAP_LABEL% ^(%M3E_MAP_ID%^)
echo [swingby] Public viewer:
echo [swingby]   https://akaghef-dell.tail6206ae.ts.net/viewer.html?ws=%M3E_WORKSPACE_ID%^^^&map=%M3E_MAP_ID%

for /f "tokens=5" %%P in ('netstat -ano ^| findstr :%M3E_PORT% ^| findstr LISTENING') do (
  if not "%%P"=="0" (
    echo [swingby] Stopping existing process on port %M3E_PORT% ^(PID %%P^)...
    taskkill /PID %%P /F >nul 2>&1
  )
)

call npm --prefix beta run build
if errorlevel 1 goto :error

call npm --prefix beta start
if errorlevel 1 goto :error
exit /b 0

:error
echo.
echo [ERROR] Swingby server launch failed.
exit /b 1
