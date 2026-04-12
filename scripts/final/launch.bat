@echo off
setlocal EnableDelayedExpansion
chcp 65001 >nul 2>&1

REM ============================================================
REM M3E Final launch script
REM - Daily startup entry point
REM - Use setup.bat for first-time setup
REM ============================================================

cd /d "%~dp0\..\.."
set "ROOT=%cd%"
if "%M3E_HOME%"=="" set "M3E_HOME=%LOCALAPPDATA%\M3E"
set "LOG_FILE=%M3E_HOME%\launch.log"

REM Load saved config (written by setup.bat), then apply env overrides.
set "CONFIG_FILE=%M3E_HOME%\m3e.conf"
if exist "%CONFIG_FILE%" (
  for /f "usebackq tokens=1,* delims==" %%A in ("%CONFIG_FILE%") do (
    if "%%A"=="M3E_HOME"          if "!M3E_HOME!"==""          set "M3E_HOME=%%B"
    if "%%A"=="M3E_SEED_DB_PATH"  if "!M3E_SEED_DB_PATH!"==""  set "M3E_SEED_DB_PATH=%%B"
    if "%%A"=="M3E_MAIN_DATA_DIR" if "!M3E_MAIN_DATA_DIR!"=="" set "M3E_MAIN_DATA_DIR=%%B"
    if "%%A"=="M3E_MAIN_DB_FILE"  if "!M3E_MAIN_DB_FILE!"==""  set "M3E_MAIN_DB_FILE=%%B"
    if "%%A"=="M3E_MAIN_DOC_ID"   if "!M3E_MAIN_DOC_ID!"==""   set "M3E_MAIN_DOC_ID=%%B"
    if "%%A"=="M3E_MAIN_WORKSPACE_ID" if "!M3E_MAIN_WORKSPACE_ID!"=="" set "M3E_MAIN_WORKSPACE_ID=%%B"
    if "%%A"=="M3E_PORT"          if "!M3E_PORT!"==""          set "M3E_PORT=%%B"
  )
)

REM Final fallback defaults.
if "!M3E_HOME!"==""             set "M3E_HOME=%LOCALAPPDATA%\M3E"
if "!M3E_SEED_DB_PATH!"==""     set "M3E_SEED_DB_PATH=!M3E_HOME!\seeds\core-seed.sqlite"
if "!M3E_MAIN_DATA_DIR!"==""    set "M3E_MAIN_DATA_DIR=!M3E_HOME!\workspaces\main"
if "!M3E_MAIN_DB_FILE!"==""     set "M3E_MAIN_DB_FILE=data.sqlite"
if "!M3E_MAIN_DOC_ID!"==""      set "M3E_MAIN_DOC_ID=akaghef-beta"
if "!M3E_MAIN_WORKSPACE_ID!"=="" set "M3E_MAIN_WORKSPACE_ID=main"
if "!M3E_PORT!"==""             set "M3E_PORT=38482"
set "M3E_DATA_DIR=!M3E_MAIN_DATA_DIR!"
set "M3E_DB_FILE=!M3E_MAIN_DB_FILE!"
set "M3E_DOC_ID=!M3E_MAIN_DOC_ID!"
set "M3E_WORKSPACE_ID=!M3E_MAIN_WORKSPACE_ID!"
set "LOG_FILE=!M3E_HOME!\launch.log"
if not exist "!M3E_HOME!" mkdir "!M3E_HOME!"
if not exist "!M3E_DATA_DIR!" mkdir "!M3E_DATA_DIR!"
for %%D in ("!M3E_SEED_DB_PATH!") do if not exist "%%~dpD" mkdir "%%~dpD" >nul 2>&1
if not exist "!M3E_SEED_DB_PATH!" (
  set "REPO_SEED=%ROOT%\install\assets\seeds\core-seed.sqlite"
  if exist "!REPO_SEED!" copy /Y "!REPO_SEED!" "!M3E_SEED_DB_PATH!" >nul
)
if not exist "!M3E_DATA_DIR!\!M3E_DB_FILE!" (
  if exist "!M3E_SEED_DB_PATH!" copy /Y "!M3E_SEED_DB_PATH!" "!M3E_DATA_DIR!\!M3E_DB_FILE!" >nul
)

REM Stop stale server process if configured port is already in use.
for /f "tokens=5" %%P in ('netstat -ano 2^>nul ^| findstr ":!M3E_PORT!" ^| findstr "LISTENING"') do (
  if not "%%P"=="0" (
    echo Stopping existing process on port !M3E_PORT! ^(PID %%P^)...
    taskkill /PID %%P /F >nul 2>&1
  )
)

REM Resolve Node path (check install2 first, then legacy install, then system)
set "NODE_CMD=node"
set "NPM_CMD="
set "NPM_FLAGS=--legacy-peer-deps"
if exist "%ROOT%\install2\node\node.exe" (
  set "NODE_CMD=%ROOT%\install2\node\node.exe"
  set "NPM_CMD=%ROOT%\install2\node\npm.cmd"
) else if exist "%ROOT%\install\node\node.exe" (
  set "NODE_CMD=%ROOT%\install\node\node.exe"
  set "NPM_CMD=%ROOT%\install\node\npm.cmd"
)
if "!NPM_CMD!"=="" (
  for /f "tokens=*" %%P in ('where npm.cmd 2^>nul') do (
    if "!NPM_CMD!"=="" set "NPM_CMD=%%P"
  )
)

set "FINAL_DIR=%ROOT%\final"
set "ENTRY_JS=%FINAL_DIR%\dist\node\start_viewer.js"
set "DOTENV_JS=%FINAL_DIR%\node_modules\dotenv\config.js"

if not exist "!DOTENV_JS!" call :repair_dependencies
if errorlevel 1 exit /b 1

if not exist "!ENTRY_JS!" call :rebuild_final
if errorlevel 1 exit /b 1

if not exist "!DOTENV_JS!" (
  echo [ERROR] Missing runtime dependency: !DOTENV_JS!
  echo [ERROR] Run install\setup.bat to repair Final.
  exit /b 1
)
if not exist "!ENTRY_JS!" (
  echo [ERROR] Missing build output: !ENTRY_JS!
  echo [ERROR] Run install\setup.bat to rebuild Final.
  exit /b 1
)

REM Launch directly (bypass npm to avoid prefix resolution issues)
"!NODE_CMD!" "!ENTRY_JS!" > "!LOG_FILE!" 2>&1
set "EXIT_CODE=!ERRORLEVEL!"

if !EXIT_CODE! neq 0 (
  echo [ERROR] Launch failed. See log: !LOG_FILE! >> "!LOG_FILE!"
  exit /b 1
)

exit /b 0

:repair_dependencies
if "!NPM_CMD!"=="" (
  echo [ERROR] npm.cmd not found. Run install\setup.bat first.
  exit /b 1
)
echo [launch] Final dependencies missing. Repairing...
call "!NPM_CMD!" --prefix "!FINAL_DIR!" ci !NPM_FLAGS!
if not !ERRORLEVEL! equ 0 (
  echo [launch] npm ci failed. Falling back to npm install...
  call "!NPM_CMD!" --prefix "!FINAL_DIR!" install !NPM_FLAGS!
  if not !ERRORLEVEL! equ 0 (
    echo [ERROR] Failed to install Final dependencies.
    exit /b 1
  )
)
exit /b 0

:rebuild_final
if "!NPM_CMD!"=="" (
  echo [ERROR] npm.cmd not found. Run install\setup.bat first.
  exit /b 1
)
echo [launch] Final build output missing. Rebuilding...
call "!NPM_CMD!" --prefix "!FINAL_DIR!" run build
if not !ERRORLEVEL! equ 0 (
  echo [ERROR] Failed to build Final.
  exit /b 1
)
exit /b 0
