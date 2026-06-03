@echo off
setlocal EnableDelayedExpansion
REM ============================================================
REM M3E Team Workspace Test ? run inside VM guest
REM
REM This is copied to C:\M3E_test_package and executed by
REM scripts\ops\vm_team_ws_test.bat via VirtualBox guestcontrol.
REM It validates the team ws package can start and exposes a viewer URL.
REM Real host-vm cross-device editing still requires Tailscale/Supabase
REM credentials and is run manually from the produced URL.
REM ============================================================

set "PKG_ROOT=%~dp0"
if "%PKG_ROOT:~-1%"=="\" set "PKG_ROOT=%PKG_ROOT:~0,-1%"

if exist "Y:\" (
  set "SHARED_REPORTS=Y:"
) else (
  set "SHARED_REPORTS=C:\M3E_test_reports"
)

for /f %%T in ('powershell -NoProfile -Command "Get-Date -Format yyyyMMdd_HHmmss"') do set "TS=%%T"
if "%TS%"=="" set "TS=%date:~0,4%%date:~5,2%%date:~8,2%_%time:~0,2%%time:~3,2%"

set "REPORT_DIR=%SHARED_REPORTS%\team_ws_%TS%"
set "REPORT_FILE=%REPORT_DIR%\report.txt"
set "TEST_PORT=4174"
if "%M3E_TEST_WORKSPACE_ID%"=="" set "M3E_TEST_WORKSPACE_ID=ws_team_swingby"
if "%M3E_TEST_WORKSPACE_LABEL%"=="" set "M3E_TEST_WORKSPACE_LABEL=Swingby Team"
if "%M3E_TEST_MAP_ID%"=="" set "M3E_TEST_MAP_ID=map_team_swingby_monthly_2604"
if "%M3E_TEST_MAP_LABEL%"=="" set "M3E_TEST_MAP_LABEL=定例会"
if "%M3E_TEST_MAP_SLUG%"=="" set "M3E_TEST_MAP_SLUG=swingby-monthly-2604"

mkdir "%REPORT_DIR%" >nul 2>&1

> "%REPORT_FILE%" (
  echo ============================================================
  echo  M3E Team Workspace VM Report
  echo  Date: %date% %time%
  echo  User: %USERNAME%
  echo  Package: %PKG_ROOT%
  echo  Workspace: %M3E_TEST_WORKSPACE_ID%
  echo  Map: %M3E_TEST_MAP_ID%
  echo  LOCALAPPDATA: %LOCALAPPDATA%
  echo ============================================================
  echo.
)

call :run_step "Setup" setup
call :run_step "Launch team client" launch
call :run_step "Smoke shared link" smoke

>> "%REPORT_FILE%" echo.
>> "%REPORT_FILE%" echo ============================================================
>> "%REPORT_FILE%" echo  Summary
>> "%REPORT_FILE%" echo ============================================================
>> "%REPORT_FILE%" echo  Setup:  %RESULT_setup%
>> "%REPORT_FILE%" echo  Launch: %RESULT_launch%
>> "%REPORT_FILE%" echo  Smoke:  %RESULT_smoke%
>> "%REPORT_FILE%" echo ============================================================

echo.
echo Team workspace VM test complete. Report: %REPORT_FILE%
exit /b 0

:run_step
set "STEP_NAME=%~1"
set "STEP_ID=%~2"
>> "%REPORT_FILE%" echo [%STEP_NAME%] Starting...
echo [%STEP_NAME%] Starting...
call :step_%STEP_ID%
set "RESULT_%STEP_ID%=%STEP_RESULT%"
>> "%REPORT_FILE%" echo [%STEP_NAME%] Result: %STEP_RESULT%
>> "%REPORT_FILE%" echo.
exit /b 0

:step_setup
set "INSTALL_ROOT=%LOCALAPPDATA%\M3E-team-test\vm"
set "APP_ROOT=%INSTALL_ROOT%\app"
set "RUNTIME_ROOT=%INSTALL_ROOT%\runtime"
set "RC=0"

for /f "tokens=5" %%P in ('netstat -ano 2^>nul ^| findstr ":%TEST_PORT%" ^| findstr "LISTENING"') do (
  if not "%%P"=="0" taskkill /PID %%P /F >nul 2>&1
)

if exist "%APP_ROOT%" rmdir /s /q "%APP_ROOT%" >nul 2>&1
if exist "%RUNTIME_ROOT%" rmdir /s /q "%RUNTIME_ROOT%" >nul 2>&1
mkdir "%APP_ROOT%" >nul 2>&1
mkdir "%RUNTIME_ROOT%" >nul 2>&1
mkdir "%INSTALL_ROOT%\seeds" >nul 2>&1

xcopy /E /I /Y "%PKG_ROOT%\payload\app" "%APP_ROOT%" >> "%REPORT_DIR%\setup.log" 2>&1
if errorlevel 1 set "RC=1"
xcopy /E /I /Y "%PKG_ROOT%\payload\runtime" "%RUNTIME_ROOT%" >> "%REPORT_DIR%\setup.log" 2>&1
if errorlevel 1 set "RC=1"
if exist "%PKG_ROOT%\install\assets\seeds\core-seed.sqlite" (
  copy /Y "%PKG_ROOT%\install\assets\seeds\core-seed.sqlite" "%INSTALL_ROOT%\seeds\core-seed.sqlite" >> "%REPORT_DIR%\setup.log" 2>&1
  if errorlevel 1 set "RC=1"
)

if "%RC%"=="0" (set "STEP_RESULT=PASS") else (set "STEP_RESULT=FAIL [exit %RC%]")
exit /b 0

:step_launch
set "INSTALL_ROOT=%LOCALAPPDATA%\M3E-team-test\vm"
set "NODE_EXE=%INSTALL_ROOT%\runtime\node.exe"
set "ENTRY_JS=%INSTALL_ROOT%\app\dist\node\start_viewer.js"
set "M3E_HOME=%INSTALL_ROOT%"
set "M3E_PORT=%TEST_PORT%"
set "M3E_CHANNEL=beta"
set "M3E_WORKSPACE_ID=%M3E_TEST_WORKSPACE_ID%"
set "M3E_WORKSPACE_LABEL=%M3E_TEST_WORKSPACE_LABEL%"
set "M3E_MAP_ID=%M3E_TEST_MAP_ID%"
set "M3E_MAP_LABEL=%M3E_TEST_MAP_LABEL%"
set "M3E_MAP_SLUG=%M3E_TEST_MAP_SLUG%"
set "M3E_DATA_DIR=%INSTALL_ROOT%\workspaces\%M3E_WORKSPACE_ID%"
set "M3E_DB_FILE=data.sqlite"
set "M3E_DOC_ID=%M3E_MAP_ID%"
set "M3E_SEED_DB_PATH=%INSTALL_ROOT%\seeds\core-seed.sqlite"
set "M3E_CLOUD_SYNC=0"
set "M3E_AUTO_SYNC=0"
set "M3E_AI_ENABLED=0"
set "M3E_OPEN_BROWSER=0"

if not exist "%NODE_EXE%" (
  set "STEP_RESULT=FAIL (node runtime missing)"
  exit /b 0
)
if not exist "%ENTRY_JS%" (
  set "STEP_RESULT=FAIL (start_viewer missing)"
  exit /b 0
)

mkdir "%M3E_DATA_DIR%" >nul 2>&1
if not exist "%M3E_DATA_DIR%\%M3E_DB_FILE%" if exist "%M3E_SEED_DB_PATH%" copy /Y "%M3E_SEED_DB_PATH%" "%M3E_DATA_DIR%\%M3E_DB_FILE%" >nul 2>&1
for /f "tokens=5" %%P in ('netstat -ano 2^>nul ^| findstr ":%TEST_PORT%" ^| findstr "LISTENING"') do (
  if not "%%P"=="0" taskkill /PID %%P /F >nul 2>&1
)
start "M3E Team WS Test" /MIN "%NODE_EXE%" "%ENTRY_JS%" > "%REPORT_DIR%\server.log" 2>&1

set /a W=0
:launch_wait
ping -n 2 127.0.0.1 >nul
powershell -NoProfile -Command "try{$r=Invoke-WebRequest -Uri 'http://127.0.0.1:%TEST_PORT%/viewer.html?ws=%M3E_TEST_WORKSPACE_ID%&map=%M3E_TEST_MAP_ID%&localMapId=%M3E_TEST_MAP_ID%&cloudMapId=%M3E_TEST_MAP_ID%' -TimeoutSec 2 -UseBasicParsing; exit 0}catch{exit 1}" >nul 2>&1
if not errorlevel 1 goto :launch_ok
set /a W+=1
if %W% GEQ 30 (
  set "STEP_RESULT=FAIL (server timeout)"
  >> "%REPORT_FILE%" type "%REPORT_DIR%\server.log"
  exit /b 0
)
goto :launch_wait

:launch_ok
set "STEP_RESULT=PASS (http://127.0.0.1:%TEST_PORT%/viewer.html?ws=%M3E_TEST_WORKSPACE_ID%&map=%M3E_TEST_MAP_ID%)"
exit /b 0

:step_smoke
powershell -NoProfile -Command "try{$r=Invoke-WebRequest -Uri 'http://127.0.0.1:%TEST_PORT%/viewer.html?ws=%M3E_TEST_WORKSPACE_ID%&map=%M3E_TEST_MAP_ID%&localMapId=%M3E_TEST_MAP_ID%&cloudMapId=%M3E_TEST_MAP_ID%' -UseBasicParsing; if($r.StatusCode -eq 200){'VIEWER_OK'}else{'VIEWER_FAIL'}}catch{'VIEWER_ERROR: '+$_.Exception.Message}" > "%REPORT_DIR%\smoke.txt" 2>&1

findstr "VIEWER_OK" "%REPORT_DIR%\smoke.txt" >nul 2>&1
if not errorlevel 1 (
  set "STEP_RESULT=PASS"
) else (
  set "STEP_RESULT=FAIL"
  >> "%REPORT_FILE%" type "%REPORT_DIR%\smoke.txt"
)
exit /b 0
