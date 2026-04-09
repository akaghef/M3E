@echo off
setlocal

REM M3E Beta full launch: Cloud Sync + Collab + AI all enabled.
REM Requires AI API key set via launch-with-ai.bat or env vars.

cd /d "%~dp0\..\.."

set "M3E_DATA_DIR=%CD%\beta\data"
if not exist "%M3E_DATA_DIR%" mkdir "%M3E_DATA_DIR%"

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
