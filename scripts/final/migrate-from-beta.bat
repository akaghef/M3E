@echo off
setlocal EnableDelayedExpansion

REM ============================================================
REM M3E Final: Beta -> Final migration script (exclude mode)
REM
REM Steps:
REM   1. Git fetch & pull
REM   2. Sync beta/ -> final/ via robocopy (exclude mode)
REM   3. npm ci (install dependencies)
REM   4. Build (npm run build)
REM   5. Data migration (if schema changed)
REM   6. Launch
REM
REM Data:
REM   - Backs up main workspace data.sqlite before migration
REM   - Backup destination: %LOCALAPPDATA%\M3E\workspaces\main\backup\
REM ============================================================

cd /d "%~dp0\..\.."

if "%M3E_HOME%"=="" set "M3E_HOME=%LOCALAPPDATA%\M3E"
if "%M3E_DATA_DIR%"=="" set "M3E_DATA_DIR=%M3E_HOME%\workspaces\main"
if not exist "%M3E_DATA_DIR%" mkdir "%M3E_DATA_DIR%"
if "%M3E_PORT%"=="" set "M3E_PORT=38482"
if "%M3E_DB_FILE%"=="" set "M3E_DB_FILE=data.sqlite"
set "DB_FILE=%M3E_DB_FILE%"

echo ============================================================
echo  M3E Final Migration: Beta ^> Final (exclude mode)
echo ============================================================
echo.

REM --- Step 1: Git fetch & pull ---
echo [1/6] Git fetch ^& pull...
call git fetch --all
if !errorlevel! neq 0 goto :error
call git pull --ff-only
if !errorlevel! neq 0 goto :error

REM --- Step 2: Sync beta/ -> final/ (exclude mode) ---
echo [2/6] Syncing beta/ -^> final/ (exclude mode)...
if not exist final mkdir final
robocopy beta\ final\ /MIR /NFL /NDL /NJH /NJS ^
  /XD node_modules dist prompts tmp public backups audit conflict-backups ^
  /XF .env Beta_Policy.md e2e_test_server.js playwright.e2e.config.js ^
     data.sqlite .m3e-launched
REM robocopy returns 0-7 for success
if !errorlevel! GTR 7 goto :error
REM Restore final-only files
call git checkout -- final\FINAL_POLICY.md 2>nul
echo   Sync complete.

REM --- Step 3: Install dependencies ---
echo [3/6] Install dependencies (final)...
echo   Stopping any running node processes to release file locks...
taskkill /f /im node.exe > nul 2>&1
timeout /t 1 /nobreak > nul
call npm --prefix final ci
if !errorlevel! neq 0 goto :error

REM --- Step 4: Build ---
echo [4/6] Build (final)...
call npm --prefix final run build
if !errorlevel! neq 0 goto :error

REM --- Step 5: Data migration ---
echo [5/6] Data migration...
if exist "%M3E_DATA_DIR%\%DB_FILE%" (
  if not exist "%M3E_DATA_DIR%\backup" mkdir "%M3E_DATA_DIR%\backup"
  set "DATESTAMP=!date:~-4!!date:~3,2!!date:~0,2!"
  set "TIMESTAMP=!time:~0,2!!time:~3,2!"
  set "TIMESTAMP=!TIMESTAMP: =0!"
  copy /Y "%M3E_DATA_DIR%\%DB_FILE%" "%M3E_DATA_DIR%\backup\%DB_FILE:~0,-7%_!DATESTAMP!_!TIMESTAMP!.sqlite" > nul
  echo   Backup saved to %M3E_DATA_DIR%\backup\
)
REM TODO: call node final/dist/node/migrate.js when schema changes occur
echo   Data migration: no schema changes (pass-through).

REM --- Step 6: Launch ---
echo [6/6] Launching Final...
call npm --prefix final start
if !errorlevel! neq 0 goto :error

echo.
echo Migration and launch completed successfully.
exit /b 0

:error
echo.
echo [ERROR] Migration failed. Check the log above.
echo   Your data has NOT been modified if the error occurred before Step 5.
pause
exit /b 1
