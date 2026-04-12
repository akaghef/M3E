@echo off
setlocal EnableExtensions EnableDelayedExpansion
REM ============================================================
REM M3E Distribution Test — Simulate fresh install as a new user
REM
REM What this does:
REM   1. Creates a temporary test directory (isolated from your data)
REM   2. Copies install package + final build into it
REM   3. Runs setup.bat → verify.bat → launch.bat → smoke test
REM   4. Reports results
REM   5. Cleans up (optional)
REM
REM Usage:
REM   scripts\ops\test_as_new_user.bat [--keep]
REM     --keep  Don't clean up after test (for manual inspection)
REM
REM Requirements:
REM   - Run from repo root (c:\Users\chiec\dev\M3E)
REM   - final/ must be built (npm run build in final/)
REM   - No admin rights needed
REM ============================================================

set "REPO_ROOT=%~dp0..\.."
cd /d "%REPO_ROOT%"

set "KEEP=0"
if /I "%~1"=="--keep" set "KEEP=1"

REM --- Test environment ---
set "TEST_HOME=%TEMP%\M3E_test_%RANDOM%"
set "TEST_INSTALL=%TEST_HOME%\install"
set "TEST_M3E_HOME=%TEST_HOME%\M3E_user"
set "TEST_PORT=39999"

echo ============================================================
echo  M3E Distribution Test (simulated new user)
echo ============================================================
echo  Test dir: %TEST_HOME%
echo  Port:     %TEST_PORT%
echo.

REM === Step 1: Create test package ===
echo [1/6] Creating test package...
mkdir "%TEST_INSTALL%\payload\app" >nul 2>&1
mkdir "%TEST_INSTALL%\payload\runtime" >nul 2>&1

REM Copy install payload
xcopy /E /I /Y install\* "%TEST_INSTALL%\install\" >nul
xcopy /E /I /Y scripts\final\* "%TEST_INSTALL%\scripts\final\" >nul
if errorlevel 1 goto :fail_step1

REM Copy final build as the "app" payload
xcopy /E /I /Y final\dist "%TEST_INSTALL%\payload\app\dist" >nul
xcopy /E /I /Y final\node_modules "%TEST_INSTALL%\payload\app\node_modules" >nul
copy /Y final\package.json "%TEST_INSTALL%\payload\app\" >nul
copy /Y final\viewer.html "%TEST_INSTALL%\payload\app\" >nul
copy /Y final\viewer.css "%TEST_INSTALL%\payload\app\" >nul

REM Copy Node.js runtime (use system node as portable runtime)
where node >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Node.js not found in PATH
  goto :cleanup
)
for /f "tokens=*" %%N in ('where node') do copy /Y "%%N" "%TEST_INSTALL%\payload\runtime\node.exe" >nul

echo   Package created.

REM === Step 2: Override env to isolate ===
echo [2/6] Setting up isolated environment...
set "LOCALAPPDATA=%TEST_M3E_HOME%"
set "M3E_PORT=%TEST_PORT%"
mkdir "%TEST_M3E_HOME%" >nul 2>&1

REM === Step 3: Run setup ===
echo [3/6] Running setup.bat...
pushd "%TEST_INSTALL%" >nul
call setup.bat --no-verify > "%TEST_HOME%\setup_output.txt" 2>&1
set "SETUP_RC=%errorlevel%"
popd >nul

if not "%SETUP_RC%"=="0" (
  echo   [FAIL] setup.bat exited with code %SETUP_RC%
  type "%TEST_HOME%\setup_output.txt"
  goto :report
)
echo   [PASS] setup.bat

REM === Step 4: Run verify ===
echo [4/6] Running verify.bat...
call "%TEST_M3E_HOME%\M3E\verify.bat" > "%TEST_HOME%\verify_output.txt" 2>&1
set "VERIFY_RC=%errorlevel%"

if not "%VERIFY_RC%"=="0" (
  echo   [FAIL] verify.bat exited with code %VERIFY_RC%
  type "%TEST_HOME%\verify_output.txt"
  goto :report
)
echo   [PASS] verify.bat

REM === Step 5: Launch and smoke test ===
echo [5/6] Launch + smoke test...

REM Start server in background
set "M3E_DATA_DIR=%TEST_M3E_HOME%\M3E\workspaces\main"
set "M3E_DB_FILE=data.sqlite"
set "M3E_DOC_ID=main-workspace"
set "M3E_PORT=%TEST_PORT%"
start /B "" "%TEST_M3E_HOME%\M3E\runtime\node.exe" "%TEST_M3E_HOME%\M3E\app\dist\node\start_viewer.js" > "%TEST_HOME%\server.log" 2>&1

REM Wait for server
set /a WAIT=0
:wait_server
timeout /t 1 /nobreak >nul
powershell -NoProfile -Command "try{(Invoke-WebRequest -Uri 'http://127.0.0.1:%TEST_PORT%/viewer.html' -TimeoutSec 2 -UseBasicParsing).StatusCode}catch{'FAIL'}" > "%TEST_HOME%\probe.txt" 2>nul
findstr "200" "%TEST_HOME%\probe.txt" >nul 2>&1
if not errorlevel 1 goto :server_ok
set /a WAIT+=1
if %WAIT% GEQ 15 goto :server_timeout
goto :wait_server

:server_ok
echo   [PASS] Server responding on port %TEST_PORT%

REM API smoke test
powershell -NoProfile -Command "(Invoke-WebRequest -Uri 'http://127.0.0.1:%TEST_PORT%/api/docs/test-smoke' -Method POST -ContentType 'application/json' -Body '{\"state\":{\"rootId\":\"r\",\"nodes\":{\"r\":{\"id\":\"r\",\"parentId\":null,\"children\":[],\"nodeType\":\"text\",\"text\":\"smoke\",\"collapsed\":false,\"details\":\"\",\"note\":\"\",\"attributes\":{},\"link\":\"\"}}}}' -UseBasicParsing).StatusCode" > "%TEST_HOME%\api_test.txt" 2>nul
findstr "200" "%TEST_HOME%\api_test.txt" >nul 2>&1
if not errorlevel 1 (
  echo   [PASS] API POST works
) else (
  echo   [FAIL] API POST failed
)

REM Kill test server
for /f "tokens=2" %%P in ('netstat -ano ^| findstr ":%TEST_PORT% .*LISTENING"') do taskkill /PID %%P /F >nul 2>&1
goto :report

:server_timeout
echo   [FAIL] Server did not start within 15s
type "%TEST_HOME%\server.log"

:report
REM === Step 6: Report ===
echo.
echo ============================================================
echo  Test Results
echo ============================================================
if "%SETUP_RC%"=="0" (echo   Setup:   PASS) else (echo   Setup:   FAIL [%SETUP_RC%])
if "%VERIFY_RC%"=="0" (echo   Verify:  PASS) else (echo   Verify:  FAIL [%VERIFY_RC%])
echo   Logs:    %TEST_HOME%\
echo ============================================================

REM === Cleanup ===
if "%KEEP%"=="1" (
  echo.
  echo  --keep flag set. Test directory preserved at:
  echo  %TEST_HOME%
  echo  Clean up manually: rmdir /s /q "%TEST_HOME%"
) else (
  echo  Cleaning up...
  rmdir /s /q "%TEST_HOME%" >nul 2>&1
)

exit /b 0

:fail_step1
echo [ERROR] Failed to create test package
exit /b 1
