@echo off

REM M3E Beta launch script (build must already exist).
REM NOTE: Do NOT use setlocal here — it prevents M3E_DATA_DIR from
REM reaching child processes when a system/user-level variable exists.

cd /d "%~dp0\..\.."
node "%~dp0..\ops\channel-runtime.mjs" build-beta "%cd%"
if errorlevel 1 exit /b 1

if "%M3E_HOME%"=="" set "M3E_HOME=%LOCALAPPDATA%\M3E"
set "M3E_CHANNEL=beta"
if "%M3E_WORKSPACE_ID%"=="" set "M3E_WORKSPACE_ID=ws_REMH1Z5TFA7S93R3HA0XK58JNR"
if "%M3E_WORKSPACE_LABEL%"=="" set "M3E_WORKSPACE_LABEL=Akaghef-personal"
if "%M3E_MAP_ID%"=="" set "M3E_MAP_ID=map_BG9BZP6NRDTEH1JYNDFGS6S3T5"
if "%M3E_MAP_LABEL%"=="" set "M3E_MAP_LABEL=開発"
if "%M3E_MAP_SLUG%"=="" set "M3E_MAP_SLUG=beta-dev"
if "%M3E_SEED_DB_PATH%"=="" set "M3E_SEED_DB_PATH=%M3E_HOME%\seeds\core-seed.sqlite"
if "%M3E_DATA_DIR%"=="" set "M3E_DATA_DIR=%M3E_HOME%\workspaces\%M3E_WORKSPACE_ID%"
if "%M3E_DB_FILE%"=="" set "M3E_DB_FILE=data.sqlite"
if not exist "%M3E_HOME%\seeds" mkdir "%M3E_HOME%\seeds" >nul 2>&1
if not exist "%M3E_DATA_DIR%" mkdir "%M3E_DATA_DIR%"
if not exist "%M3E_SEED_DB_PATH%" if exist "%CD%\install\assets\seeds\core-seed.sqlite" copy /Y "%CD%\install\assets\seeds\core-seed.sqlite" "%M3E_SEED_DB_PATH%" >nul
if not exist "%M3E_DATA_DIR%\%M3E_DB_FILE%" if exist "%M3E_SEED_DB_PATH%" copy /Y "%M3E_SEED_DB_PATH%" "%M3E_DATA_DIR%\%M3E_DB_FILE%" >nul

echo [launch] M3E_DATA_DIR=%M3E_DATA_DIR%
echo [launch] M3E_DB_FILE=%M3E_DB_FILE%
echo [launch] M3E_WORKSPACE=%M3E_WORKSPACE_LABEL% ^(%M3E_WORKSPACE_ID%^)
echo [launch] M3E_MAP=%M3E_MAP_LABEL% ^(%M3E_MAP_ID%^, %M3E_MAP_SLUG%^)

call :kill_port_4173

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
