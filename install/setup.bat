@echo off
setlocal EnableDelayedExpansion

REM ============================================================
REM  M3E Installer
REM  - Downloads portable Node.js automatically (no pre-install needed)
REM  - Builds the app and creates a desktop shortcut
REM ============================================================

cd /d "%~dp0\.."
set "ROOT=%cd%"

set "NODE_VERSION=22.14.0"
set "NODE_DIR=%ROOT%\install\node"
set "NODE_EXE=%NODE_DIR%\node.exe"
set "NPM_CMD=%NODE_DIR%\npm.cmd"

echo.
echo  =============================================
echo   M3E Setup
echo  =============================================
echo.

REM ============================================================
REM  Step 1 — Ensure Node.js is available
REM ============================================================

if exist "%NODE_EXE%" (
  echo   Portable Node.js found.
  goto :node_ready
)

REM Check if system Node.js is available
where node >nul 2>&1
if not !errorlevel! equ 0 goto :download_node

for /f "tokens=*" %%V in ('node --version') do set "SYS_NODE_VER=%%V"
echo   System Node.js !SYS_NODE_VER! found.
set "NODE_EXE=node"
for /f "tokens=*" %%P in ('where npm.cmd') do set "NPM_CMD=%%P"
goto :node_ready

:download_node
echo   Node.js not found. Downloading portable Node.js %NODE_VERSION%...
echo.

set "NODE_ZIP=%TEMP%\node-v%NODE_VERSION%-win-x64.zip"
set "NODE_URL=https://nodejs.org/dist/v%NODE_VERSION%/node-v%NODE_VERSION%-win-x64.zip"
set "NODE_EXTRACT=%TEMP%\node-v%NODE_VERSION%-win-x64"

REM Download using PowerShell
powershell -NoProfile -ExecutionPolicy Bypass -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri '!NODE_URL!' -OutFile '!NODE_ZIP!'"
if not !errorlevel! equ 0 (
  echo.
  echo [ERROR] Download failed. Please check your internet connection.
  pause
  exit /b 1
)

echo   Download complete. Extracting...

REM Extract using PowerShell
if exist "!NODE_EXTRACT!" rmdir /s /q "!NODE_EXTRACT!"
powershell -NoProfile -ExecutionPolicy Bypass -Command "Expand-Archive -Path '!NODE_ZIP!' -DestinationPath '%TEMP%' -Force"
if not !errorlevel! equ 0 (
  echo [ERROR] Extraction failed.
  pause
  exit /b 1
)

REM Move to install/node/
if exist "!NODE_DIR!" rmdir /s /q "!NODE_DIR!"
move "!NODE_EXTRACT!" "!NODE_DIR!" >nul
del "!NODE_ZIP!" >nul 2>&1

echo   Node.js %NODE_VERSION% installed to install\node\

:node_ready
echo.

REM ============================================================
REM  Step 2 — Ask for data save location
REM ============================================================

echo  Where would you like to save your M3E data?
echo  (This is where your database file will be stored.)
echo.
echo  Press Enter to use the default location,
echo  or type a custom path:
echo.
echo    Default: %%LOCALAPPDATA%%\M3E
echo.
set /p "USER_DATA_DIR=  Path (or Enter for default): "

if "!USER_DATA_DIR!"=="" (
  set "M3E_DATA_DIR=%LOCALAPPDATA%\M3E"
) else (
  set "M3E_DATA_DIR=!USER_DATA_DIR!"
)

echo.
echo   Save location: !M3E_DATA_DIR!

REM Create data directory
if not exist "!M3E_DATA_DIR!" mkdir "!M3E_DATA_DIR!"

REM ============================================================
REM  Step 3 — Save config
REM ============================================================

set "CONFIG_DIR=%LOCALAPPDATA%\M3E"
set "CONFIG_FILE=%CONFIG_DIR%\m3e.conf"
if not exist "!CONFIG_DIR!" mkdir "!CONFIG_DIR!"
> "!CONFIG_FILE!" echo M3E_DATA_DIR=!M3E_DATA_DIR!
>>"!CONFIG_FILE!" echo M3E_PORT=38482
>>"!CONFIG_FILE!" echo M3E_ROOT=!ROOT!
echo   Config saved to: !CONFIG_FILE!

REM ============================================================
REM  Step 4 — Install dependencies & build
REM ============================================================

echo.
echo  [1/2] Installing dependencies...
call "!NPM_CMD!" --prefix "!ROOT!\final" ci
if not !errorlevel! equ 0 (
  echo.
  echo   npm ci failed. Trying npm install...
  call "!NPM_CMD!" --prefix "!ROOT!\final" install
  if not !errorlevel! equ 0 (
    echo [ERROR] Dependency installation failed.
    pause
    exit /b 1
  )
)
echo   Dependencies installed.

echo.
echo  [2/2] Building M3E...
call "!NPM_CMD!" --prefix "!ROOT!\final" run build
if not !errorlevel! equ 0 (
  echo [ERROR] Build failed.
  pause
  exit /b 1
)
echo   Build complete.

REM ============================================================
REM  Step 5 — Create desktop shortcut
REM ============================================================

echo.
echo  Creating desktop shortcut...

set "SHORTCUT_VBS=%TEMP%\m3e_shortcut.vbs"
set "SHORTCUT_PATH=%USERPROFILE%\Desktop\M3E.lnk"
set "LAUNCH_VBS=!ROOT!\scripts\final\launch-hidden.vbs"

> "!SHORTCUT_VBS!" echo Set oWS = WScript.CreateObject("WScript.Shell")
>>"!SHORTCUT_VBS!" echo Set oLink = oWS.CreateShortcut("!SHORTCUT_PATH!")
>>"!SHORTCUT_VBS!" echo oLink.TargetPath = "wscript.exe"
>>"!SHORTCUT_VBS!" echo oLink.Arguments = """!LAUNCH_VBS!"""
>>"!SHORTCUT_VBS!" echo oLink.WorkingDirectory = "!ROOT!"
>>"!SHORTCUT_VBS!" echo oLink.Description = "M3E Viewer"
>>"!SHORTCUT_VBS!" echo oLink.Save

cscript //nologo "!SHORTCUT_VBS!" >nul 2>&1
del "!SHORTCUT_VBS!" >nul 2>&1

if exist "!SHORTCUT_PATH!" (
  echo   Desktop shortcut created: M3E.lnk
) else (
  echo   (Shortcut creation skipped)
)

REM ============================================================
REM  Done
REM ============================================================

echo.
echo  =============================================
echo   Setup Complete!
echo  =============================================
echo.
echo   Data location : !M3E_DATA_DIR!
echo   Launch        : Double-click "M3E" on your Desktop
echo.
set /p "LAUNCH_NOW=  Launch M3E now? [Y/n]: "
if /i "!LAUNCH_NOW!"=="n" goto :done

call "!ROOT!\scripts\final\launch.bat"
:done
echo.
exit /b 0
