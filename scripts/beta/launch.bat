@echo off

REM M3E Beta launch script (build must already exist).
REM NOTE: Do NOT use setlocal here — it prevents M3E_DATA_DIR from
REM reaching child processes when a system/user-level variable exists.

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

echo [launch] M3E_DATA_DIR=%M3E_DATA_DIR%
echo [launch] M3E_DB_FILE=%M3E_DB_FILE%
echo [launch] M3E_WORKSPACE=%M3E_WORKSPACE_LABEL% ^(%M3E_WORKSPACE_ID%^)
echo [launch] M3E_MAP=%M3E_MAP_LABEL% ^(%M3E_MAP_ID%^, %M3E_MAP_SLUG%^)

REM --- Build freshness check: auto-rebuild if beta/src is newer than beta/dist ---
set "BUILD_STATE=UNKNOWN"
for /f "usebackq delims=" %%T in (`powershell -NoProfile -Command "$d=(Get-Item beta\dist\browser\viewer.js -ErrorAction SilentlyContinue).LastWriteTime; $s=(Get-ChildItem beta\src -Recurse -File -ErrorAction SilentlyContinue | Measure-Object LastWriteTime -Maximum).Maximum; $ds= if($d){$d.ToString('yyyy-MM-dd HH:mm:ss')}else{'(missing)'}; $ss= if($s){$s.ToString('yyyy-MM-dd HH:mm:ss')}else{'(missing)'}; Write-Output ('dist=' + $ds); Write-Output ('src =' + $ss); if(-not $d -or ($s -and $s -gt $d)){ Write-Output 'STATE=STALE' } else { Write-Output 'STATE=FRESH' }"`) do (
  echo [launch] %%T
  for /f "tokens=1,2 delims==" %%A in ("%%T") do if /i "%%A"=="STATE" set "BUILD_STATE=%%B"
)
if /i "%BUILD_STATE%"=="STALE" (
  echo [launch] dist is stale — rebuilding beta...
  call npm --prefix beta run build
  if errorlevel 1 goto :error
)

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
