@echo off
setlocal

REM ============================================================
REM M3E Final: Beta → Final migration スクリプト
REM
REM 実行内容:
REM   1. 最新コードを取得 (git pull)
REM   2. beta/ のソースを final/ へ同期
REM   3. 依存関係インストール (npm ci)
REM   4. ビルド (npm run build)
REM   5. データ migration (スキーマ変更がある場合)
REM   6. 起動確認
REM
REM データについて:
REM   - migration前に final/data/m3e.sqlite を自動バックアップします
REM   - バックアップ先: final/data/backup/
REM ============================================================

cd /d "%~dp0\..\.."

if "%M3E_DATA_DIR%"=="" set "M3E_DATA_DIR=%APPDATA%\M3E"
if not exist "%M3E_DATA_DIR%" mkdir "%M3E_DATA_DIR%"

echo ============================================================
echo  M3E Final Migration: Beta ^> Final
echo ============================================================
echo.

REM --- Step 1: 最新コードを取得 ---
echo [1/6] Git fetch ^& pull...
call git fetch --all
if errorlevel 1 goto :error
call git pull --ff-only
if errorlevel 1 goto :error

REM --- Step 2: beta/ ソースを final/ へ同期 ---
echo [2/6] Syncing beta/ source to final/...
REM src, tests, legacy, viewer files, package.json, tsconfig を同期
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
REM data: sample files only (sqlite は別管理)
if not exist final\data mkdir final\data
xcopy /Y beta\data\*.json final\data\ > nul 2>&1
xcopy /Y beta\data\*.mm final\data\ > nul 2>&1
echo   Sync complete.

REM --- Step 3: 依存関係インストール ---
echo [3/6] Install dependencies (final)...
call npm --prefix final ci
if errorlevel 1 goto :error

REM --- Step 4: ビルド ---
echo [4/6] Build (final)...
call npm --prefix final run build
if errorlevel 1 goto :error

REM --- Step 5: データ migration ---
echo [5/6] Data migration...
REM バックアップ
if exist "%M3E_DATA_DIR%\rapid-mvp.sqlite" (
  if not exist "%M3E_DATA_DIR%\backup" mkdir "%M3E_DATA_DIR%\backup"
  for /f "tokens=1-3 delims=/ " %%a in ("%date%") do set DATESTR=%%c%%b%%a
  for /f "tokens=1-2 delims=: " %%a in ("%time%") do set TIMESTR=%%a%%b
  copy /Y "%M3E_DATA_DIR%\rapid-mvp.sqlite" "%M3E_DATA_DIR%\backup\rapid-mvp_%DATESTR%_%TIMESTR%.sqlite" > nul
  echo   Backup saved: %M3E_DATA_DIR%\backup\rapid-mvp_%DATESTR%_%TIMESTR%.sqlite
)
REM TODO: スキーマ変更が発生した場合は、ここで migration スクリプトを呼び出す
REM   例: node final/dist/node/migrate.js
echo   Data migration: no schema changes (pass-through).

REM --- Step 6: 起動確認 ---
echo [6/6] Launching Final...
call npm --prefix final start
if errorlevel 1 goto :error

echo.
echo Migration and launch completed successfully.
exit /b 0

:error
echo.
echo [ERROR] Migration failed. Check the log above.
echo   Your data has NOT been modified if the error occurred before Step 5.
pause
exit /b 1
