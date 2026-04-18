@echo off
setlocal

REM M3E Beta full launch: Cloud Sync + Collab + AI all enabled.
REM Requires AI API key set via launch-with-ai.bat or env vars.

cd /d "%~dp0\..\.."

if "%M3E_HOME%"=="" set "M3E_HOME=%LOCALAPPDATA%\M3E"
set "M3E_CHANNEL=beta"
set "M3E_WORKSPACE_ID=ws_REMH1Z5TFA7S93R3HA0XK58JNR"
set "M3E_WORKSPACE_LABEL=Akaghef-personal"
set "M3E_MAP_ID=map_BG9BZP6NRDTEH1JYNDFGS6S3T5"
set "M3E_MAP_LABEL=開発"
set "M3E_MAP_SLUG=beta-dev"
set "M3E_SEED_DB_PATH=%M3E_HOME%\seeds\core-seed.sqlite"
set "M3E_DATA_DIR=%M3E_HOME%\workspaces\%M3E_WORKSPACE_ID%"
set "M3E_DB_FILE=data.sqlite"
if not exist "%M3E_HOME%\seeds" mkdir "%M3E_HOME%\seeds" >nul 2>&1
if not exist "%M3E_DATA_DIR%" mkdir "%M3E_DATA_DIR%"
if not exist "%M3E_SEED_DB_PATH%" if exist "%CD%\install\assets\seeds\core-seed.sqlite" copy /Y "%CD%\install\assets\seeds\core-seed.sqlite" "%M3E_SEED_DB_PATH%" >nul
if not exist "%M3E_DATA_DIR%\%M3E_DB_FILE%" if exist "%M3E_SEED_DB_PATH%" copy /Y "%M3E_SEED_DB_PATH%" "%M3E_DATA_DIR%\%M3E_DB_FILE%" >nul

REM --- Cloud Sync ---
set "M3E_CLOUD_SYNC=1"
if "%M3E_CLOUD_DIR%"=="" set "M3E_CLOUD_DIR=%M3E_DATA_DIR%\cloud-sync"
if "%M3E_CLOUD_TRANSPORT%"=="" set "M3E_CLOUD_TRANSPORT=file"

REM --- Collab ---
set "M3E_COLLAB=1"

REM --- AI (must be configured externally or via env vars) ---
if "%M3E_AI_ENABLED%"=="" set "M3E_AI_ENABLED=1"

call :kill_port_4173

echo Launching M3E Beta (full mode: Cloud Sync + Collab + AI)
echo   Cloud Sync: %M3E_CLOUD_TRANSPORT% (%M3E_CLOUD_DIR%)
echo   Collab:     enabled
echo   AI:         %M3E_AI_PROVIDER% / %M3E_AI_MODEL%
echo.

call npm --prefix beta start
if errorlevel 1 goto :error

exit /b 0

:kill_port_4173
for /f "tokens=5" %%P in ('netstat -ano ^| findstr :4173 ^| findstr LISTENING') do (
  if not "%%P"=="0" (
    echo Stopping existing process on port 4173 ^(PID %%P^)...
    taskkill /PID %%P /F >nul 2>&1
  )
)
exit /b 0

:error
echo.
echo [ERROR] Launch failed. Check beta build and try again.
echo   Use scripts\beta\update-and-launch.bat after dependency updates.
pause
exit /b 1
