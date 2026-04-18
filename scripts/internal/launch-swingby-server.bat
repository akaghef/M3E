@echo off
setlocal EnableDelayedExpansion

REM Internal Swingby team-collab server launcher.
REM Runs beta as the shared backend for ws_team_swingby.

cd /d "%~dp0\..\.."

if "%M3E_HOME%"=="" set "M3E_HOME=%LOCALAPPDATA%\M3E"
if "%M3E_SWINGBY_PORT%"=="" set "M3E_SWINGBY_PORT=4173"
if "%M3E_COLLAB_JOIN_TOKEN%"=="" (
  echo [swingby-server] ERROR: M3E_COLLAB_JOIN_TOKEN is not set.
  echo [swingby-server] Example:
  echo   set M3E_COLLAB_JOIN_TOKEN=replace-this-token
  echo   scripts\internal\launch-swingby-server.bat
  exit /b 1
)

set "M3E_CHANNEL=beta"
set "M3E_COLLAB=1"
set "M3E_WORKSPACE_ID=ws_team_swingby"
set "M3E_WORKSPACE_LABEL=Swingby Team"
set "M3E_MAP_ID=map_team_swingby_home"
set "M3E_MAP_LABEL=team-home"
set "M3E_MAP_SLUG=team-home"
set "M3E_PORT=%M3E_SWINGBY_PORT%"
set "M3E_DB_FILE=data.sqlite"
set "M3E_DATA_DIR=%M3E_HOME%\workspaces\%M3E_WORKSPACE_ID%"
set "M3E_SEED_DB_PATH=%M3E_HOME%\seeds\core-seed.sqlite"

if not exist "%M3E_HOME%\seeds" mkdir "%M3E_HOME%\seeds" >nul 2>&1
if not exist "%M3E_DATA_DIR%" mkdir "%M3E_DATA_DIR%" >nul 2>&1
if not exist "%M3E_SEED_DB_PATH%" if exist "%CD%\install\assets\seeds\core-seed.sqlite" copy /Y "%CD%\install\assets\seeds\core-seed.sqlite" "%M3E_SEED_DB_PATH%" >nul
if not exist "%M3E_DATA_DIR%\%M3E_DB_FILE%" if exist "%M3E_SEED_DB_PATH%" copy /Y "%M3E_SEED_DB_PATH%" "%M3E_DATA_DIR%\%M3E_DB_FILE%" >nul

echo [swingby-server] DATA_DIR=%M3E_DATA_DIR%
echo [swingby-server] WORKSPACE=%M3E_WORKSPACE_LABEL% (%M3E_WORKSPACE_ID%)
echo [swingby-server] MAP=%M3E_MAP_LABEL% (%M3E_MAP_ID%)
echo [swingby-server] PORT=%M3E_PORT%
echo [swingby-server] COLLAB=on

set "BUILD_STATE=UNKNOWN"
for /f "usebackq delims=" %%T in (`powershell -NoProfile -Command "$d=(Get-Item beta\dist\browser\viewer.js -ErrorAction SilentlyContinue).LastWriteTime; $s=(Get-ChildItem beta\src -Recurse -File -ErrorAction SilentlyContinue | Measure-Object LastWriteTime -Maximum).Maximum; if(-not $d -or ($s -and $s -gt $d)){ Write-Output 'STATE=STALE' } else { Write-Output 'STATE=FRESH' }"`) do (
  for /f "tokens=1,2 delims==" %%A in ("%%T") do if /i "%%A"=="STATE" set "BUILD_STATE=%%B"
)
if /i "%BUILD_STATE%"=="STALE" (
  echo [swingby-server] dist is stale - rebuilding beta...
  call npm --prefix beta run build
  if errorlevel 1 goto :error
)

call :kill_port

call npm --prefix beta start
if errorlevel 1 goto :error
exit /b 0

:kill_port
for /f "tokens=5" %%P in ('netstat -ano 2^>nul ^| findstr :%M3E_PORT% ^| findstr LISTENING') do (
  if not "%%P"=="0" (
    echo [swingby-server] Stopping existing process on port %M3E_PORT% ^(PID %%P^)...
    taskkill /PID %%P /F >nul 2>&1
  )
)
exit /b 0

:error
echo.
echo [swingby-server] ERROR: launch failed.
exit /b 1
