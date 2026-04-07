@echo off
setlocal EnableDelayedExpansion

REM ============================================================
REM  M3E Installer
REM  One-time setup: sets save location, builds app, creates shortcut
REM ============================================================

cd /d "%~dp0"

echo.
echo  =============================================
echo   M3E Setup
echo  =============================================
echo.

REM --- Check Node.js ---
where node >nul 2>&1
if %errorlevel% neq 0 (
  echo [ERROR] Node.js is not installed.
  echo.
  echo   Please install Node.js from: https://nodejs.org/
  echo   Recommended: LTS version ^(20 or later^)
  echo.
  pause
  exit /b 1
)
for /f "tokens=*" %%V in ('node --version') do set NODE_VER=%%V
echo   Node.js %NODE_VER% found.

REM --- Ask for data save location ---
echo.
echo  Where would you like to save your M3E data?
echo  ^(This is where your database file will be stored.^)
echo.
echo  Press Enter to use the default location,
echo  or type a custom path:
echo.
echo    Default: %APPDATA%\M3E
echo.
set /p "USER_DATA_DIR=  Path (or Enter for default): "

if "!USER_DATA_DIR!"=="" (
  set "M3E_DATA_DIR=%APPDATA%\M3E"
) else (
  set "M3E_DATA_DIR=!USER_DATA_DIR!"
)

REM Expand any %...% variables in user input
call set "M3E_DATA_DIR=!M3E_DATA_DIR!"

echo.
echo   Save location: !M3E_DATA_DIR!

REM --- Create data directory ---
if not exist "!M3E_DATA_DIR!" (
  mkdir "!M3E_DATA_DIR!"
  if %errorlevel% neq 0 (
    echo [ERROR] Could not create directory: !M3E_DATA_DIR!
    echo   Please check the path and try again.
    pause
    exit /b 1
  )
  echo   Directory created.
) else (
  echo   Directory already exists.
)

REM --- Save config ---
set "CONFIG_FILE=%APPDATA%\M3E\m3e.conf"
if not exist "%APPDATA%\M3E" mkdir "%APPDATA%\M3E"
echo M3E_DATA_DIR=!M3E_DATA_DIR!> "%CONFIG_FILE%"
echo M3E_PORT=38482>> "%CONFIG_FILE%"
echo   Config saved to: %CONFIG_FILE%

REM --- Install dependencies ---
echo.
echo  [1/2] Installing dependencies...
call npm --prefix final ci
if %errorlevel% neq 0 (
  echo.
  echo [ERROR] npm ci failed. Trying npm install...
  call npm --prefix final install
  if %errorlevel% neq 0 (
    echo [ERROR] Dependency installation failed.
    pause
    exit /b 1
  )
)
echo   Dependencies installed.

REM --- Build ---
echo.
echo  [2/2] Building M3E...
call npm --prefix final run build
if %errorlevel% neq 0 (
  echo [ERROR] Build failed. Check the output above.
  pause
  exit /b 1
)
echo   Build complete.

REM --- Create desktop shortcut ---
echo.
echo  Creating desktop shortcut...
set "SHORTCUT_VBS=%TEMP%\m3e_shortcut.vbs"
set "SHORTCUT_PATH=%USERPROFILE%\Desktop\M3E.lnk"
set "LAUNCH_BAT=%~dp0scripts\final\launch.bat"

(
  echo Set oWS = WScript.CreateObject^("WScript.Shell"^)
  echo sLinkFile = "%SHORTCUT_PATH%"
  echo Set oLink = oWS.CreateShortcut^(sLinkFile^)
  echo oLink.TargetPath = "wscript.exe"
  echo oLink.Arguments = """%~dp0scripts\final\launch-hidden.vbs"""
  echo oLink.WorkingDirectory = "%~dp0"
  echo oLink.Description = "M3E Viewer"
  echo oLink.Save
) > "%SHORTCUT_VBS%"

cscript //nologo "%SHORTCUT_VBS%" >nul 2>&1
del "%SHORTCUT_VBS%" >nul 2>&1

if exist "%SHORTCUT_PATH%" (
  echo   Desktop shortcut created: M3E.lnk
) else (
  echo   ^(Shortcut creation skipped - you can launch via scripts\final\launch.bat^)
)

REM --- Done ---
echo.
echo  =============================================
echo   Setup Complete!
echo  =============================================
echo.
echo   Data location : !M3E_DATA_DIR!
echo   Launch        : Double-click "M3E" on your Desktop
echo                   or run: scripts\final\launch.bat
echo.
set /p "LAUNCH_NOW=  Launch M3E now? [Y/n]: "
if /i "!LAUNCH_NOW!"=="n" goto :done

call scripts\final\launch.bat
:done
echo.
exit /b 0
