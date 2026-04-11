@echo off
setlocal EnableDelayedExpansion
REM ============================================================
REM M3E VM Test — Automated clean-environment test via VirtualBox
REM
REM Prerequisites:
REM   - VirtualBox installed with VBoxManage in PATH
REM   - VM named "M3E-Test" with snapshot "clean"
REM   - Shared folders configured:
REM       C:\M3E_test_package  -> M3E_pkg    (read-only, auto-mount)
REM       C:\M3E_test_reports  -> M3E_reports (full access, auto-mount)
REM
REM Usage:
REM   scripts\ops\vm_test.bat          (cold: restore snapshot + test)
REM   scripts\ops\vm_test.bat warm     (warm: run test on already-running VM)
REM ============================================================

set "VM_NAME=M3E-Test"
set "SNAPSHOT=clean"
set "GUEST_USER=m3etest"
set "GUEST_PASS=m3etest"
set "WAIT_BOOT=60"
set "WAIT_TEST=300"

REM --- VBoxManage full path ---
set "VBOX=C:\Program Files\Oracle\VirtualBox\VBoxManage.exe"
if not exist "%VBOX%" (
    echo [ERROR] VBoxManage not found at %VBOX%
    exit /b 1
)

REM --- Warm mode: skip restore + boot ---
if /i "%~1"=="warm" goto :warm_mode

echo ============================================================
echo  M3E VM Test (cold)
echo  VM: %VM_NAME%  Snapshot: %SNAPSHOT%
echo ============================================================
echo.

REM --- Step 1: Restore clean snapshot ---
echo [1/5] Restoring snapshot "%SNAPSHOT%"...
"%VBOX%" snapshot "%VM_NAME%" restore "%SNAPSHOT%"
if errorlevel 1 (
    echo [ERROR] Failed to restore snapshot. Is the VM powered off?
    "%VBOX%" controlvm "%VM_NAME%" poweroff >nul 2>&1
    ping -n 6 127.0.0.1 >nul
    "%VBOX%" snapshot "%VM_NAME%" restore "%SNAPSHOT%"
    if errorlevel 1 (
        echo [ERROR] Still failed. Aborting.
        exit /b 1
    )
)

REM --- Step 2: Start VM (GUI window) ---
echo [2/5] Starting VM (GUI)...
"%VBOX%" startvm "%VM_NAME%" --type gui
if errorlevel 1 (
    echo [ERROR] Failed to start VM.
    exit /b 1
)

REM --- Step 3: Wait for VM to boot ---
echo [3/5] Waiting %WAIT_BOOT%s for VM to boot...
ping -n %WAIT_BOOT% 127.0.0.1 >nul

REM Verify guest is responsive (retry up to 5 times, 30s apart)
set /a RETRY=0
:guest_wait
"%VBOX%" guestcontrol "%VM_NAME%" run --username "%GUEST_USER%" --password "%GUEST_PASS%" --exe "C:\Windows\System32\cmd.exe" -- cmd /c "echo ready" >nul 2>&1
if not errorlevel 1 goto :guest_ok
set /a RETRY+=1
if %RETRY% GEQ 5 (
    echo [ERROR] Guest OS not responding after %RETRY% retries. Check VM manually.
    "%VBOX%" controlvm "%VM_NAME%" poweroff >nul 2>&1
    exit /b 1
)
echo       Guest not ready yet, retry %RETRY%/5... waiting 30s
ping -n 31 127.0.0.1 >nul
goto :guest_wait
:guest_ok
echo       Guest OS is ready.

REM --- Step 4: Run test inside VM ---
echo [4/5] Running test inside VM (timeout %WAIT_TEST%s)...
"%VBOX%" guestcontrol "%VM_NAME%" run ^
    --username "%GUEST_USER%" ^
    --password "%GUEST_PASS%" ^
    --exe "C:\Windows\System32\cmd.exe" ^
    --timeout %WAIT_TEST%000 ^
    -- cmd /c "Z:\run_test.bat"

set "TEST_RC=%errorlevel%"
if "%TEST_RC%"=="0" (
    echo       Test completed successfully.
) else (
    echo       Test exited with code %TEST_RC%.
)

REM --- Step 5: Leave VM running for manual inspection ---
echo [5/5] VM left running for manual inspection.

echo.
echo ============================================================
echo  VM Test finished. VM is still running — check manually.
echo  To power off: VBoxManage controlvm "%VM_NAME%" poweroff
echo  Report: type C:\M3E_test_reports\test_*\report.txt
echo ============================================================

exit /b %TEST_RC%

REM ============================================================
REM Warm mode — VM is already running, just run the test
REM ============================================================
:warm_mode
echo ============================================================
echo  M3E VM Test (warm — VM already running)
echo ============================================================
echo.
echo Running test inside VM...
"%VBOX%" guestcontrol "%VM_NAME%" run ^
    --username "%GUEST_USER%" ^
    --password "%GUEST_PASS%" ^
    --exe "C:\Windows\System32\cmd.exe" ^
    --timeout %WAIT_TEST%000 ^
    -- cmd /c "Z:\run_test.bat"
set "TEST_RC=%errorlevel%"
echo.
echo ============================================================
echo  VM Test finished (warm). Check results:
echo    type C:\M3E_test_reports\test_*\report.txt
echo ============================================================
exit /b %TEST_RC%
