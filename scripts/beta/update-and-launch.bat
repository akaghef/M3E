@echo off
setlocal

REM M3E Beta update-and-launch script.

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
set "M3E_DOC_ID=%M3E_MAP_ID%"
if not exist "%M3E_HOME%\seeds" mkdir "%M3E_HOME%\seeds" >nul 2>&1
if not exist "%M3E_DATA_DIR%" mkdir "%M3E_DATA_DIR%"
if not exist "%M3E_SEED_DB_PATH%" if exist "%CD%\install\assets\seeds\core-seed.sqlite" copy /Y "%CD%\install\assets\seeds\core-seed.sqlite" "%M3E_SEED_DB_PATH%" >nul
if not exist "%M3E_DATA_DIR%\%M3E_DB_FILE%" if exist "%M3E_SEED_DB_PATH%" copy /Y "%M3E_SEED_DB_PATH%" "%M3E_DATA_DIR%\%M3E_DB_FILE%" >nul

call :kill_port_4173

echo [1/5] Git fetch...
call git fetch --all
if errorlevel 1 goto :error

echo [2/5] Git pull...
call git pull --ff-only
if errorlevel 1 goto :error

echo [3/5] Install dependencies (beta)...
call npm --prefix beta ci
if errorlevel 1 goto :error

echo [4/5] Build (beta)...
call npm --prefix beta run build
if errorlevel 1 goto :error

echo [5/5] Launch...
call npm --prefix beta start
if errorlevel 1 goto :error

echo.
echo Completed.
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
echo [ERROR] Update or launch failed. Check logs above.
pause
exit /b 1
