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
set "LOG_FILE=%LOCALAPPDATA%\M3E\launch.log"

REM Load saved config (written by setup.bat), then apply env overrides.
set "CONFIG_FILE=%LOCALAPPDATA%\M3E\m3e.conf"
if exist "%CONFIG_FILE%" (
  for /f "usebackq tokens=1,* delims==" %%A in ("%CONFIG_FILE%") do (
    if "%%A"=="M3E_DATA_DIR" if "!M3E_DATA_DIR!"=="" set "M3E_DATA_DIR=%%B"
    if "%%A"=="M3E_PORT"     if "!M3E_PORT!"==""     set "M3E_PORT=%%B"
  )
)

REM Final fallback defaults.
if "!M3E_DATA_DIR!"=="" set "M3E_DATA_DIR=%LOCALAPPDATA%\M3E"
if "!M3E_PORT!"==""     set "M3E_PORT=38482"
if not exist "!M3E_DATA_DIR!" mkdir "!M3E_DATA_DIR!"

REM Stop stale server process if configured port is already in use.
for /f "tokens=5" %%P in ('netstat -ano 2^>nul ^| findstr ":!M3E_PORT!" ^| findstr "LISTENING"') do (
  if not "%%P"=="0" (
    echo Stopping existing process on port !M3E_PORT! ^(PID %%P^)...
    taskkill /PID %%P /F >nul 2>&1
  )
)

REM Resolve Node path (check install2 first, then legacy install, then system)
set "NODE_CMD=node"
if exist "%ROOT%\install2\node\node.exe" (
  set "NODE_CMD=%ROOT%\install2\node\node.exe"
) else if exist "%ROOT%\install\node\node.exe" (
  set "NODE_CMD=%ROOT%\install\node\node.exe"
)

REM Rebuild native addons if Node.js version changed
set "NODE_VER_FILE=%ROOT%\final\.node_version"
for /f "tokens=*" %%V in ('"!NODE_CMD!" -v') do set "CURRENT_NODE_VER=%%V"
set "LAST_NODE_VER="
if exist "!NODE_VER_FILE!" for /f "tokens=*" %%V in (!NODE_VER_FILE!) do set "LAST_NODE_VER=%%V"
if not "!CURRENT_NODE_VER!"=="!LAST_NODE_VER!" (
  echo Rebuilding native modules for Node.js !CURRENT_NODE_VER!... >> "!LOG_FILE!"
  pushd "%ROOT%\final"
  "!NODE_CMD!" -e "require('child_process').execSync('npm rebuild', {stdio:'inherit'})" >> "!LOG_FILE!" 2>&1
  popd
  echo !CURRENT_NODE_VER!> "!NODE_VER_FILE!"
)

REM Launch directly (bypass npm to avoid prefix resolution issues)
"!NODE_CMD!" "%ROOT%\final\dist\node\start_viewer.js" > "!LOG_FILE!" 2>&1
set "EXIT_CODE=!ERRORLEVEL!"

if !EXIT_CODE! neq 0 (
  echo [ERROR] Launch failed. See log: !LOG_FILE! >> "!LOG_FILE!"
  exit /b 1
)

exit /b 0
