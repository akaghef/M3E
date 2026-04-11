@echo off
setlocal EnableDelayedExpansion
REM ============================================================
REM M3E Distribution Test — Run as m3e_test user
REM
REM This script runs the full install→verify→launch→smoke cycle
REM and writes a report to C:\M3E_test_reports\ for Akaghef to review.
REM
REM Usage (from Akaghef's account):
REM   runas /user:m3e_test "C:\M3E_test_package\run_test.bat"
REM ============================================================

set "PKG_ROOT=%~dp0"
if "%PKG_ROOT:~-1%"=="\" set "PKG_ROOT=%PKG_ROOT:~0,-1%"

set "SHARED_REPORTS=C:\M3E_test_reports"
for /f %%T in ('powershell -NoProfile -Command "Get-Date -Format yyyyMMdd_HHmmss"') do set "TS=%%T"
if "%TS%"=="" set "TS=%date:~0,4%%date:~5,2%%date:~8,2%_%time:~0,2%%time:~3,2%"
set "REPORT_DIR=%SHARED_REPORTS%\test_%TS%"
set "REPORT_FILE=%REPORT_DIR%\report.txt"
set "TEST_PORT=39876"

mkdir "%REPORT_DIR%" >nul 2>&1

REM Header
> "%REPORT_FILE%" (
  echo ============================================================
  echo  M3E Distribution Test Report
  echo  Date: %date% %time%
  echo  User: %USERNAME%
  echo  Package: %PKG_ROOT%
  echo  LOCALAPPDATA: %LOCALAPPDATA%
  echo ============================================================
  echo.
)

call :run_step "Setup" setup
call :run_step "Verify" verify
call :run_step "Launch" launch
call :run_step "Smoke" smoke

>> "%REPORT_FILE%" (
  echo.
  echo ============================================================
  echo  Summary
  echo ============================================================
  echo  Setup:   %RESULT_SETUP%
  echo  Verify:  %RESULT_VERIFY%
  echo  Launch:  %RESULT_LAUNCH%
  echo  Smoke:   %RESULT_SMOKE%
  echo ============================================================
)

echo.
echo ============================================================
echo  Test complete. Report: %REPORT_FILE%
echo  Setup:   %RESULT_SETUP%
echo  Verify:  %RESULT_VERIFY%
echo  Launch:  %RESULT_LAUNCH%
echo  Smoke:   %RESULT_SMOKE%
echo ============================================================

REM Collect diagnostic report too
if exist "%LOCALAPPDATA%\M3E\collect_report.bat" (
  call "%LOCALAPPDATA%\M3E\collect_report.bat" "post-test" >nul 2>&1
  REM Copy report zip to shared dir
  for %%F in ("%LOCALAPPDATA%\M3E\reports\*.zip") do copy /Y "%%F" "%REPORT_DIR%\" >nul 2>&1
)

exit /b 0

REM ============================================================
REM Steps
REM ============================================================

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
pushd "%PKG_ROOT%" >nul
call setup.bat --no-verify > "%REPORT_DIR%\setup.log" 2>&1
set "RC=%errorlevel%"
popd >nul
copy /Y "%LOCALAPPDATA%\M3E\logs\setup.log" "%REPORT_DIR%\setup_detail.log" >nul 2>&1
if "%RC%"=="0" (set "STEP_RESULT=PASS") else (set "STEP_RESULT=FAIL [exit %RC%]")
exit /b 0

:step_verify
if not exist "%LOCALAPPDATA%\M3E\verify.bat" (
  set "STEP_RESULT=SKIP (verify.bat not found)"
  exit /b 0
)
call "%LOCALAPPDATA%\M3E\verify.bat" > "%REPORT_DIR%\verify.log" 2>&1
set "RC=%errorlevel%"
copy /Y "%LOCALAPPDATA%\M3E\logs\verify.log" "%REPORT_DIR%\verify_detail.log" >nul 2>&1
if "%RC%"=="0" (set "STEP_RESULT=PASS") else (set "STEP_RESULT=FAIL [exit %RC%]")
exit /b 0

:step_launch
set "M3E_DATA_DIR=%LOCALAPPDATA%\M3E\data"
set "M3E_PORT=%TEST_PORT%"
if not exist "%LOCALAPPDATA%\M3E\runtime\node.exe" (
  set "STEP_RESULT=SKIP (runtime not installed)"
  exit /b 0
)
if not exist "%LOCALAPPDATA%\M3E\app\dist\node\start_viewer.js" (
  set "STEP_RESULT=SKIP (app not installed)"
  exit /b 0
)

start /B "" "%LOCALAPPDATA%\M3E\runtime\node.exe" "%LOCALAPPDATA%\M3E\app\dist\node\start_viewer.js" > "%REPORT_DIR%\server.log" 2>&1

set /a W=0
:launch_wait
timeout /t 1 /nobreak >nul
powershell -NoProfile -Command "try{$r=Invoke-WebRequest -Uri 'http://127.0.0.1:%TEST_PORT%/viewer.html' -TimeoutSec 2 -UseBasicParsing; exit 0}catch{exit 1}" >nul 2>&1
if not errorlevel 1 goto :launch_ok
set /a W+=1
if %W% GEQ 20 (
  set "STEP_RESULT=FAIL (server timeout)"
  >> "%REPORT_FILE%" type "%REPORT_DIR%\server.log"
  exit /b 0
)
goto :launch_wait

:launch_ok
set "STEP_RESULT=PASS (port %TEST_PORT%)"
exit /b 0

:step_smoke
REM POST a test document
powershell -NoProfile -Command "$body='{\"state\":{\"rootId\":\"r\",\"nodes\":{\"r\":{\"id\":\"r\",\"parentId\":null,\"children\":[],\"nodeType\":\"text\",\"text\":\"smoke-test\",\"collapsed\":false,\"details\":\"\",\"note\":\"\",\"attributes\":{},\"link\":\"\"}}}}'; try{$r=Invoke-WebRequest -Uri 'http://127.0.0.1:%TEST_PORT%/api/docs/smoke-test' -Method POST -ContentType 'application/json' -Body $body -UseBasicParsing; if($r.StatusCode -eq 200){'POST_OK'}else{'POST_FAIL'}}catch{'POST_ERROR: '+$_.Exception.Message}" > "%REPORT_DIR%\smoke.txt" 2>&1

findstr "POST_OK" "%REPORT_DIR%\smoke.txt" >nul 2>&1
if not errorlevel 1 (
  REM GET it back
  powershell -NoProfile -Command "try{$r=Invoke-WebRequest -Uri 'http://127.0.0.1:%TEST_PORT%/api/docs/smoke-test' -UseBasicParsing; if($r.Content -match 'smoke-test'){'GET_OK'}else{'GET_MISMATCH'}}catch{'GET_ERROR'}" >> "%REPORT_DIR%\smoke.txt" 2>&1
  findstr "GET_OK" "%REPORT_DIR%\smoke.txt" >nul 2>&1
  if not errorlevel 1 (
    set "STEP_RESULT=PASS"
  ) else (
    set "STEP_RESULT=FAIL (GET failed)"
  )
) else (
  set "STEP_RESULT=FAIL (POST failed)"
  >> "%REPORT_FILE%" type "%REPORT_DIR%\smoke.txt"
)

REM Leave test server running for manual inspection
REM for /f "tokens=5" %%P in ('netstat -ano ^| findstr ":%TEST_PORT% .*LISTENING"') do taskkill /PID %%P /F >nul 2>&1
exit /b 0
