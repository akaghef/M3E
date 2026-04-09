@echo off
setlocal
chcp 65001 >nul 2>&1

REM ============================================================
REM  M3E Installer
REM  - Downloads portable Node.js automatically (no pre-install needed)
REM  - Builds the app and creates a desktop shortcut with icon
REM ============================================================

REM Set ROOT before enabling delayed expansion so ! in paths is safe
cd /d "%~dp0\.."
set "ROOT=%cd%"

set "NODE_VERSION=22.14.0"
set "NODE_DIR=%ROOT%\install\node"
set "NODE_EXE=%NODE_DIR%\node.exe"
set "NPM_CMD=%NODE_DIR%\npm.cmd"
set "ICON_SRC=%ROOT%\install\assets\icon.ico"

setlocal EnableDelayedExpansion

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
if %ERRORLEVEL% neq 0 goto :download_node

for /f "tokens=*" %%V in ('node --version 2^>nul') do set "SYS_NODE_VER=%%V"
echo   System Node.js %SYS_NODE_VER% found.
set "NODE_EXE=node"

REM Resolve system npm.cmd path safely
set "NPM_CMD="
for /f "tokens=*" %%P in ('where npm.cmd 2^>nul') do (
  if not defined NPM_CMD set "NPM_CMD=%%P"
)
if not defined NPM_CMD (
  echo   [WARN] npm.cmd not found on PATH. Trying portable download...
  goto :download_node
)
goto :node_ready

:download_node
echo   Node.js not found. Downloading portable Node.js %NODE_VERSION%...
echo.

set "NODE_ZIP=%TEMP%\node-v%NODE_VERSION%-win-x64.zip"
set "NODE_URL=https://nodejs.org/dist/v%NODE_VERSION%/node-v%NODE_VERSION%-win-x64.zip"
set "NODE_EXTRACT=%TEMP%\node-v%NODE_VERSION%-win-x64"

REM Download using PowerShell (with progress bar disabled for speed)
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ProgressPreference = 'SilentlyContinue'; [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri '%NODE_URL%' -OutFile '%NODE_ZIP%'"
if %ERRORLEVEL% neq 0 (
  echo.
  echo   [ERROR] Download failed. Please check your internet connection.
  pause
  exit /b 1
)

echo   Download complete. Extracting...

REM Extract using PowerShell
if exist "%NODE_EXTRACT%" rmdir /s /q "%NODE_EXTRACT%"
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ProgressPreference = 'SilentlyContinue'; Expand-Archive -Path '%NODE_ZIP%' -DestinationPath '%TEMP%' -Force"
if %ERRORLEVEL% neq 0 (
  echo   [ERROR] Extraction failed.
  pause
  exit /b 1
)

REM Move to install/node/
if exist "%NODE_DIR%" rmdir /s /q "%NODE_DIR%"
move "%NODE_EXTRACT%" "%NODE_DIR%" >nul
del "%NODE_ZIP%" >nul 2>&1

echo   Node.js %NODE_VERSION% installed to install\node\
set "NODE_EXE=%NODE_DIR%\node.exe"
set "NPM_CMD=%NODE_DIR%\npm.cmd"

:node_ready

REM Add portable Node.js to PATH so child processes (node-gyp etc.) can find node
if exist "%NODE_DIR%\node.exe" set "PATH=%NODE_DIR%;%PATH%"

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
REM  Step 2.5 — Copy tutorial data if first install
REM ============================================================

set "TUTORIAL_SRC=%ROOT%\install\assets\tutorial"
if exist "%TUTORIAL_SRC%" (
  if not exist "!M3E_DATA_DIR!\m3e.db" (
    echo   Copying tutorial data...
    xcopy "%TUTORIAL_SRC%\*" "!M3E_DATA_DIR!\" /E /I /Y /Q >nul 2>&1
    echo   Tutorial data installed.
  ) else (
    echo   Existing data found. Skipping tutorial data.
  )
)

REM ============================================================
REM  Step 3 — Save config
REM ============================================================

set "CONFIG_DIR=%LOCALAPPDATA%\M3E"
set "CONFIG_FILE=%CONFIG_DIR%\m3e.conf"
if not exist "%CONFIG_DIR%" mkdir "%CONFIG_DIR%"
> "%CONFIG_FILE%" echo M3E_DATA_DIR=!M3E_DATA_DIR!
>>"%CONFIG_FILE%" echo M3E_PORT=38482
>>"%CONFIG_FILE%" echo M3E_ROOT=%ROOT%
echo   Config saved to: %CONFIG_FILE%

REM ============================================================
REM  Step 4 — Install dependencies & build
REM ============================================================

echo.
echo  [1/2] Installing dependencies...
pushd "%ROOT%\final"
call "%NPM_CMD%" ci
if %ERRORLEVEL% neq 0 (
  echo.
  echo   npm ci failed. Trying npm install...
  call "%NPM_CMD%" install
  if %ERRORLEVEL% neq 0 (
    popd
    echo   [ERROR] Dependency installation failed.
    pause
    exit /b 1
  )
)
echo   Dependencies installed.

echo.
echo  [2/2] Building M3E...
call "%NPM_CMD%" run build
if %ERRORLEVEL% neq 0 (
  popd
  echo   [ERROR] Build failed.
  pause
  exit /b 1
)
popd
echo   Build complete.

REM ============================================================
REM  Step 5 — Convert icon (JPG -> ICO) if needed
REM ============================================================

if not exist "%ICON_SRC%" (
  echo.
  echo  Converting app icon...
  set "JPG_SRC=%ROOT%\install\assets\image.jpg"
  if exist "!JPG_SRC!" (
    powershell -NoProfile -ExecutionPolicy Bypass -Command "$ProgressPreference = 'SilentlyContinue'; Add-Type -AssemblyName System.Drawing; $img = [System.Drawing.Image]::FromFile('%ROOT%\install\assets\image.jpg'); $bmp = New-Object System.Drawing.Bitmap($img, 256, 256); $icon = [System.Drawing.Icon]::FromHandle($bmp.GetHicon()); $fs = [System.IO.FileStream]::new('%ROOT%\install\assets\icon.ico', [System.IO.FileMode]::Create); $icon.Save($fs); $fs.Close(); $icon.Dispose(); $bmp.Dispose(); $img.Dispose()"
    if exist "%ICON_SRC%" (
      echo   Icon created: install\assets\icon.ico
    ) else (
      echo   [WARN] Icon conversion failed. Shortcut will use default icon.
    )
  )
)

REM ============================================================
REM  Step 6 — Create desktop shortcut (with icon)
REM ============================================================

echo.
echo  Creating shortcuts...

set "SHORTCUT_VBS=%TEMP%\m3e_shortcut.vbs"
set "LAUNCH_VBS=%ROOT%\scripts\final\launch-hidden.vbs"

REM Create shortcut helper VBS (reused for desktop + start menu)
set "ICON_LINE="
if exist "%ICON_SRC%" set "ICON_LINE=oLink.IconLocation = ""%ICON_SRC%"""

REM --- Desktop shortcut ---
set "SHORTCUT_PATH=%USERPROFILE%\Desktop\M3E.lnk"

> "%SHORTCUT_VBS%" echo Set oWS = WScript.CreateObject("WScript.Shell")
>>"%SHORTCUT_VBS%" echo Set oLink = oWS.CreateShortcut("%SHORTCUT_PATH%")
>>"%SHORTCUT_VBS%" echo oLink.TargetPath = "wscript.exe"
>>"%SHORTCUT_VBS%" echo oLink.Arguments = """%LAUNCH_VBS%"""
>>"%SHORTCUT_VBS%" echo oLink.WorkingDirectory = "%ROOT%"
>>"%SHORTCUT_VBS%" echo oLink.Description = "M3E Viewer"
if defined ICON_LINE >>"%SHORTCUT_VBS%" echo !ICON_LINE!
>>"%SHORTCUT_VBS%" echo oLink.Save

cscript //nologo "%SHORTCUT_VBS%" >nul 2>&1
del "%SHORTCUT_VBS%" >nul 2>&1

if exist "%SHORTCUT_PATH%" (
  echo   Desktop shortcut created: M3E.lnk
) else (
  echo   (Desktop shortcut skipped)
)

REM --- Start Menu shortcut (appears in "All Apps") ---
set "START_MENU_DIR=%APPDATA%\Microsoft\Windows\Start Menu\Programs"
set "START_SHORTCUT=%START_MENU_DIR%\M3E.lnk"

> "%SHORTCUT_VBS%" echo Set oWS = WScript.CreateObject("WScript.Shell")
>>"%SHORTCUT_VBS%" echo Set oLink = oWS.CreateShortcut("%START_SHORTCUT%")
>>"%SHORTCUT_VBS%" echo oLink.TargetPath = "wscript.exe"
>>"%SHORTCUT_VBS%" echo oLink.Arguments = """%LAUNCH_VBS%"""
>>"%SHORTCUT_VBS%" echo oLink.WorkingDirectory = "%ROOT%"
>>"%SHORTCUT_VBS%" echo oLink.Description = "M3E Viewer"
if defined ICON_LINE >>"%SHORTCUT_VBS%" echo !ICON_LINE!
>>"%SHORTCUT_VBS%" echo oLink.Save

cscript //nologo "%SHORTCUT_VBS%" >nul 2>&1
del "%SHORTCUT_VBS%" >nul 2>&1

if exist "%START_SHORTCUT%" (
  echo   Start Menu shortcut created (appears in All Apps)
) else (
  echo   (Start Menu shortcut skipped)
)

if exist "%ICON_SRC%" echo   Icon applied: install\assets\icon.ico

REM ============================================================
REM  Done
REM ============================================================

echo.
echo  =============================================
echo   Setup Complete!
echo  =============================================
echo.
echo   Data location : !M3E_DATA_DIR!
echo   Launch        : Desktop or Start Menu から "M3E" を起動
echo.
set /p "LAUNCH_NOW=  Launch M3E now? [Y/n]: "
if /i "!LAUNCH_NOW!"=="n" goto :done

call "%ROOT%\scripts\final\launch.bat"
:done
echo.
echo  Press any key to close this window...
pause >nul
exit /b 0
