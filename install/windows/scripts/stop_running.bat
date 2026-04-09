@echo off
setlocal EnableExtensions EnableDelayedExpansion

call "%~dp0..\common_env.bat"
if errorlevel 1 exit /b %errorlevel%

set "WAIT_SEC=15"
if /I "%~1"=="--wait" if not "%~2"=="" set "WAIT_SEC=%~2"

set "LOCK_PID="
set "LOCK_PORT="
if exist "%M3E_LOCK_FILE%" (
  for /f "usebackq tokens=1* delims==" %%A in ("%M3E_LOCK_FILE%") do (
    if /I "%%~A"=="pid" set "LOCK_PID=%%~B"
    if /I "%%~A"=="port" set "LOCK_PORT=%%~B"
  )
)

if not defined LOCK_PID (
  exit /b 0
)

tasklist /FI "PID eq %LOCK_PID%" | find " %LOCK_PID% " >nul 2>&1
if errorlevel 1 (
  del /q "%M3E_LOCK_FILE%" >nul 2>&1
  exit /b 0
)

taskkill /PID %LOCK_PID% /T /F >nul 2>&1
if errorlevel 1 exit /b 1

set /a ELAPSED=0
:wait_loop
tasklist /FI "PID eq %LOCK_PID%" | find " %LOCK_PID% " >nul 2>&1
if errorlevel 1 goto :done
if %ELAPSED% GEQ %WAIT_SEC% exit /b 2
timeout /t 1 /nobreak >nul
set /a ELAPSED+=1
goto :wait_loop

:done
del /q "%M3E_LOCK_FILE%" >nul 2>&1
if defined LOCK_PORT (
  timeout /t 1 /nobreak >nul
)
exit /b 0
