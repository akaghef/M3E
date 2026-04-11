@echo off
setlocal EnableExtensions EnableDelayedExpansion

REM ============================================================
REM  M3E Setup
REM  - Adds unattended options for automation
REM ============================================================

cd /d "%~dp0\.."
set "ROOT=%cd%"

set "NODE_VERSION=22.14.0"
set "NODE_DIR=%ROOT%\install\node"
set "NODE_EXE=%NODE_DIR%\node.exe"
set "NPM_CMD=%NODE_DIR%\npm.cmd"

set "SILENT=0"
set "NO_LAUNCH=0"
set "M3E_DATA_DIR="
set "LOG_FILE="

call :parse_args %*
if not "%errorlevel%"=="0" exit /b %errorlevel%

if "%SILENT%"=="1" if "%NO_LAUNCH%"=="0" set "NO_LAUNCH=1"
if "%M3E_DATA_DIR%"=="" set "M3E_DATA_DIR=%LOCALAPPDATA%\M3E"

if defined LOG_FILE call :init_log

call :log "============================================="
call :log " M3E Setup v2"
call :log "============================================="
call :log ""

if exist "%NODE_EXE%" (
  call :log " Portable Node.js found in install\node."
  goto :node_ready
)

where node >nul 2>&1
if not !errorlevel! equ 0 goto :download_node

for /f "tokens=*" %%V in ('node --version') do set "SYS_NODE_VER=%%V"
call :log " System Node.js !SYS_NODE_VER! found."
set "NODE_EXE=node"
for /f "tokens=*" %%P in ('where npm.cmd') do set "NPM_CMD=%%P"
goto :node_ready

:download_node
call :log " Node.js not found. Downloading portable Node.js %NODE_VERSION%..."
set "NODE_ZIP=%TEMP%\node-v%NODE_VERSION%-win-x64.zip"
set "NODE_URL=https://nodejs.org/dist/v%NODE_VERSION%/node-v%NODE_VERSION%-win-x64.zip"
set "NODE_EXTRACT=%TEMP%\node-v%NODE_VERSION%-win-x64"

powershell -NoProfile -ExecutionPolicy Bypass -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri '!NODE_URL!' -OutFile '!NODE_ZIP!'"
if not !errorlevel! equ 0 call :fail "Download failed. Please check your internet connection."

call :log " Download complete. Extracting..."
if exist "!NODE_EXTRACT!" rmdir /s /q "!NODE_EXTRACT!"
powershell -NoProfile -ExecutionPolicy Bypass -Command "Expand-Archive -Path '!NODE_ZIP!' -DestinationPath '%TEMP%' -Force"
if not !errorlevel! equ 0 call :fail "Extraction failed."

if exist "!NODE_DIR!" rmdir /s /q "!NODE_DIR!"
move "!NODE_EXTRACT!" "!NODE_DIR!" >nul
del "!NODE_ZIP!" >nul 2>&1

call :log " Node.js %NODE_VERSION% installed to install\node\"

:node_ready
call :log ""
call :log " Data location: %M3E_DATA_DIR%"
if not exist "%M3E_DATA_DIR%" mkdir "%M3E_DATA_DIR%"

set "CONFIG_DIR=%LOCALAPPDATA%\M3E"
set "CONFIG_FILE=%CONFIG_DIR%\m3e.conf"
if not exist "%CONFIG_DIR%" mkdir "%CONFIG_DIR%"
> "%CONFIG_FILE%" echo M3E_DATA_DIR=%M3E_DATA_DIR%
>>"%CONFIG_FILE%" echo M3E_PORT=38482
>>"%CONFIG_FILE%" echo M3E_ROOT=%ROOT%
call :log " Config saved to: %CONFIG_FILE%"

REM Copy tutorial data on first install
set "TUTORIAL_SRC=%ROOT%\install\assets\tutorial"
if exist "%TUTORIAL_SRC%" (
  if not exist "%M3E_DATA_DIR%\M3E_dataV1.sqlite" (
    call :log ""
    call :log " Copying tutorial data (first install)..."
    xcopy "%TUTORIAL_SRC%\M3E_dataV1.sqlite" "%M3E_DATA_DIR%\" /E /I /Y >nul 2>&1
    call :log " Tutorial data copied."
  )
)

call :log ""
call :log " Stopping any running M3E process..."
set "M3E_PORT=38482"
for /f "tokens=5" %%P in ('netstat -ano 2^>nul ^| findstr ":!M3E_PORT!" ^| findstr "LISTENING"') do (
  if not "%%P"=="0" (
    call :log " Stopping PID %%P on port !M3E_PORT!..."
    taskkill /PID %%P /F >nul 2>&1
    REM Wait briefly for file handles to release
    timeout /t 2 /nobreak >nul 2>&1
  )
)

call :log ""
call :log " [1/2] Installing dependencies..."
call "%NPM_CMD%" --prefix "%ROOT%\final" ci
if not !errorlevel! equ 0 (
  call :log " npm ci failed. Trying npm install..."
  call "%NPM_CMD%" --prefix "%ROOT%\final" install
  if not !errorlevel! equ 0 call :fail "Dependency installation failed."
)
call :log " Dependencies installed."

call :log ""
call :log " [2/2] Building M3E..."
call "%NPM_CMD%" --prefix "%ROOT%\final" run build
if not !errorlevel! equ 0 call :fail "Build failed."
call :log " Build complete."

call :log ""
call :log " Creating desktop shortcut..."
set "SHORTCUT_VBS=%TEMP%\m3e_shortcut.vbs"
set "SHORTCUT_PATH=%USERPROFILE%\Desktop\M3E.lnk"
set "LAUNCH_VBS=%ROOT%\scripts\final\launch-hidden.vbs"
set "ICON_PATH=%ROOT%\install\assets\icons\m3e-app.ico"

> "%SHORTCUT_VBS%" echo Set oWS = WScript.CreateObject("WScript.Shell")
>>"%SHORTCUT_VBS%" echo Set oLink = oWS.CreateShortcut("%SHORTCUT_PATH%")
>>"%SHORTCUT_VBS%" echo oLink.TargetPath = "wscript.exe"
>>"%SHORTCUT_VBS%" echo oLink.Arguments = """%LAUNCH_VBS%"""
>>"%SHORTCUT_VBS%" echo oLink.WorkingDirectory = "%ROOT%"
>>"%SHORTCUT_VBS%" echo oLink.Description = "M3E Viewer"
if exist "%ICON_PATH%" >>"%SHORTCUT_VBS%" echo oLink.IconLocation = """%ICON_PATH%"""
>>"%SHORTCUT_VBS%" echo oLink.Save

cscript //nologo "%SHORTCUT_VBS%" >nul 2>&1
del "%SHORTCUT_VBS%" >nul 2>&1

if exist "%SHORTCUT_PATH%" (
  call :log " Desktop shortcut created: M3E.lnk"
) else (
  call :log " Shortcut creation skipped."
)

call :log ""
call :log "============================================="
call :log " Setup Complete"
call :log "============================================="
call :log " Data location : %M3E_DATA_DIR%"
call :log ""

if "%NO_LAUNCH%"=="1" goto :done
if "%SILENT%"=="1" goto :done

set /p "LAUNCH_NOW= Launch M3E now? [Y/n]: "
if /i "%LAUNCH_NOW%"=="n" goto :done

call "%ROOT%\scripts\final\launch.bat"

:done
exit /b 0

:parse_args
if "%~1"=="" exit /b 0
if /i "%~1"=="--silent" (
  set "SILENT=1"
  shift
  goto :parse_args
)
if /i "%~1"=="--no-launch" (
  set "NO_LAUNCH=1"
  shift
  goto :parse_args
)
if /i "%~1"=="--data-dir" (
  if "%~2"=="" (
    echo [ERROR] --data-dir requires a path.
    call :usage
    exit /b 2
  )
  set "M3E_DATA_DIR=%~2"
  shift
  shift
  goto :parse_args
)
if /i "%~1"=="--log" (
  if "%~2"=="" (
    echo [ERROR] --log requires a file path.
    call :usage
    exit /b 2
  )
  set "LOG_FILE=%~2"
  shift
  shift
  goto :parse_args
)
if /i "%~1"=="--help" (
  call :usage
  exit /b 0
)

echo [ERROR] Unknown argument: %~1
call :usage
exit /b 2

:usage
echo Usage: setup.bat [--silent] [--no-launch] [--data-dir "PATH"] [--log "FILE"]
exit /b 0

:init_log
for %%D in ("%LOG_FILE%") do set "LOG_DIR=%%~dpD"
if not "%LOG_DIR%"=="" if not exist "%LOG_DIR%" mkdir "%LOG_DIR%"
> "%LOG_FILE%" echo [%date% %time%] M3E setup log start
exit /b 0

:log
set "MSG=%~1"
echo %MSG%
if defined LOG_FILE >>"%LOG_FILE%" echo [%date% %time%] %MSG%
exit /b 0

:fail
call :log "[ERROR] %~1"
if "%SILENT%"=="1" exit /b 1
echo.
pause
exit /b 1
