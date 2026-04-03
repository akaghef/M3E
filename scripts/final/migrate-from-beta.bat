@echo off
setlocal

REM ============================================================
REM M3E Final: Beta -> Final migration script
REM
REM Steps:
REM   1. Git fetch & pull
REM   2. Sync beta/ source to final/
REM   3. npm ci (install dependencies)
REM   4. Build (npm run build)
REM   5. Data migration (if schema changed)
REM   6. Launch
REM
REM Data:
REM   - Backs up rapid-mvp.sqlite before migration
REM   - Backup destination: %APPDATA%\M3E\backup\
REM ============================================================

cd /d "%~dp0\..\.."

if "%M3E_DATA_DIR%"=="" set "M3E_DATA_DIR=%APPDATA%\M3E"
if not exist "%M3E_DATA_DIR%" mkdir "%M3E_DATA_DIR%"
if "%M3E_PORT%"=="" set "M3E_PORT=38482"

echo ============================================================
echo  M3E Final Migration: Beta ^> Final
echo ============================================================
echo.

REM --- Step 1: Git fetch & pull ---
echo [1/6] Git fetch ^& pull...
call git fetch --all
if %errorlevel% neq 0 goto :error
call git pull --ff-only
if %errorlevel% neq 0 goto :error

REM --- Step 2: Sync beta/ source to final/ ---
echo [2/6] Syncing beta/ source to final/...
if not exist final mkdir final
xcopy /E /I /Y beta\src final\src > nul
xcopy /E /I /Y beta\tests final\tests > nul
xcopy /E /I /Y beta\legacy final\legacy > nul
xcopy /Y beta\viewer.html final\ > nul
xcopy /Y beta\viewer.css final\ > nul
xcopy /Y beta\package.json final\ > nul
xcopy /Y beta\package-lock.json final\ > nul
xcopy /Y beta\tsconfig.browser.json final\ > nul
xcopy /Y beta\tsconfig.node.json final\ > nul
xcopy /Y beta\playwright.config.js final\ > nul
xcopy /Y beta\test_server.js final\ > nul
if not exist final\data mkdir final\data
xcopy /Y beta\data\*.json final\data\ > nul 2>&1
xcopy /Y beta\data\*.mm final\data\ > nul 2>&1
echo   Sync complete.

REM --- Step 3: Install dependencies ---
echo [3/6] Install dependencies (final)...
echo   Stopping any running node processes to release file locks...
taskkill /f /im node.exe > nul 2>&1
timeout /t 1 /nobreak > nul
call npm --prefix final ci
if %errorlevel% neq 0 goto :error

REM --- Step 4: Build ---
echo [4/6] Build (final)...
call npm --prefix final run build
if %errorlevel% neq 0 goto :error

REM --- Step 5: Data migration ---
echo [5/6] Data migration...
if exist "%M3E_DATA_DIR%\rapid-mvp.sqlite" (
  if not exist "%M3E_DATA_DIR%\backup" mkdir "%M3E_DATA_DIR%\backup"
  set DATESTAMP=%date:~-4%%date:~3,2%%date:~0,2%
  set TIMESTAMP=%time:~0,2%%time:~3,2%
  set TIMESTAMP=%TIMESTAMP: =0%
  copy /Y "%M3E_DATA_DIR%\rapid-mvp.sqlite" "%M3E_DATA_DIR%\backup\rapid-mvp_%DATESTAMP%_%TIMESTAMP%.sqlite" > nul
  echo   Backup saved to %M3E_DATA_DIR%\backup\
)
REM TODO: call node final/dist/node/migrate.js when schema changes occur
echo   Data migration: no schema changes (pass-through).

REM --- Step 6: Launch ---
echo [6/6] Launching Final...
call npm --prefix final start
if %errorlevel% neq 0 goto :error

echo.
echo Migration and launch completed successfully.
exit /b 0

:error
echo.
echo [ERROR] Migration failed. Check the log above.
echo   Your data has NOT been modified if the error occurred before Step 5.
pause
exit /b 1
