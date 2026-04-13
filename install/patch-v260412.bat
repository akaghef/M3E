@echo off
setlocal EnableExtensions EnableDelayedExpansion
chcp 65001 >nul 2>&1

REM ============================================================
REM  M3E Patch v260412
REM  Fixes: corrupted node_modules from failed first install
REM         (node not in PATH during native module build)
REM
REM  Usage: right-click > Run as Administrator (recommended)
REM         or double-click (works if no permission issues)
REM ============================================================

echo.
echo  M3E Patch v260412
echo  =================
echo.

REM --- Detect M3E install location ---
set "M3E_DIR="

REM Check Inno Setup location (Program Files)
if exist "%ProgramFiles%\M3E\final" set "M3E_DIR=%ProgramFiles%\M3E"
if exist "%LOCALAPPDATA%\Programs\M3E\final" set "M3E_DIR=%LOCALAPPDATA%\Programs\M3E"

REM Check dist-based location
if "%M3E_DIR%"=="" if exist "%LOCALAPPDATA%\M3E\app" set "M3E_DIR=%LOCALAPPDATA%\M3E"

if "%M3E_DIR%"=="" (
  echo  [ERROR] M3E installation not found.
  echo  Expected locations:
  echo    %LOCALAPPDATA%\Programs\M3E
  echo    %ProgramFiles%\M3E
  echo    %LOCALAPPDATA%\M3E
  echo.
  echo  If M3E is installed elsewhere, drag this script
  echo  into the M3E install folder and run from there.
  pause
  exit /b 1
)

echo  Found M3E at: %M3E_DIR%
echo.

REM --- Step 1: Stop any running M3E process ---
echo  [1/4] Stopping running M3E processes...
set "M3E_PORT=38482"
for /f "tokens=5" %%P in ('netstat -ano 2^>nul ^| findstr ":%M3E_PORT%" ^| findstr "LISTENING"') do (
  if not "%%P"=="0" (
    echo        Killing PID %%P on port %M3E_PORT%...
    taskkill /PID %%P /F >nul 2>&1
  )
)
REM Also kill any stray node processes in the M3E directory
wmic process where "ExecutablePath like '%%M3E%%node.exe'" call terminate >nul 2>&1
timeout /t 3 /nobreak >nul 2>&1
echo  [OK]
echo.

REM --- Step 2: Remove corrupted node_modules ---
set "NM_DIR="
if exist "%M3E_DIR%\final\node_modules" set "NM_DIR=%M3E_DIR%\final\node_modules"
if "%NM_DIR%"=="" if exist "%M3E_DIR%\app\node_modules" set "NM_DIR=%M3E_DIR%\app\node_modules"

if "%NM_DIR%"=="" (
  echo  [2/4] No node_modules found. Skipping cleanup.
) else (
  echo  [2/4] Removing corrupted node_modules...
  echo        %NM_DIR%

  REM First attempt: normal rmdir
  rmdir /s /q "%NM_DIR%" >nul 2>&1

  if exist "%NM_DIR%" (
    echo        First attempt failed. Clearing read-only flags...
    attrib -r -h -s "%NM_DIR%\*.*" /s /d >nul 2>&1
    rmdir /s /q "%NM_DIR%" >nul 2>&1
  )

  if exist "%NM_DIR%" (
    echo        Still locked. Trying robocopy empty-dir trick...
    set "EMPTY_DIR=%TEMP%\m3e_empty_%RANDOM%"
    mkdir "!EMPTY_DIR!" >nul 2>&1
    robocopy "!EMPTY_DIR!" "%NM_DIR%" /MIR /R:1 /W:1 >nul 2>&1
    rmdir /s /q "%NM_DIR%" >nul 2>&1
    rmdir /s /q "!EMPTY_DIR!" >nul 2>&1
  )

  if exist "%NM_DIR%" (
    echo  [WARN] Could not fully remove node_modules.
    echo         Close all editors and terminals, then retry.
    echo         Or restart the PC and run this patch again.
    pause
    exit /b 1
  )
  echo  [OK]
)
echo.

REM --- Step 3: Find Node.js and add to PATH ---
echo  [3/4] Locating Node.js...
set "NODE_EXE="
set "NPM_CMD="

REM Check portable node in various locations
for %%D in (
  "%M3E_DIR%\install\node"
  "%M3E_DIR%\install2\node"
  "%M3E_DIR%\runtime"
  "%LOCALAPPDATA%\M3E\runtime"
) do (
  if exist "%%~D\node.exe" (
    if "!NODE_EXE!"=="" (
      set "NODE_EXE=%%~D\node.exe"
      set "NPM_CMD=%%~D\npm.cmd"
      set "PATH=%%~D;!PATH!"
    )
  )
)

REM Fall back to system node
if "!NODE_EXE!"=="" (
  where node >nul 2>&1
  if !errorlevel! equ 0 (
    for /f "tokens=*" %%P in ('where node') do if "!NODE_EXE!"=="" set "NODE_EXE=%%P"
    for /f "tokens=*" %%P in ('where npm.cmd 2^>nul') do if "!NPM_CMD!"=="" set "NPM_CMD=%%P"
  )
)

if "!NODE_EXE!"=="" (
  echo  [ERROR] Node.js not found. Please install Node.js or
  echo          re-run the M3E installer to get portable Node.
  pause
  exit /b 1
)

for /f "tokens=*" %%V in ('"!NODE_EXE!" -v') do set "NODE_VER=%%V"
echo        Node: !NODE_EXE! (!NODE_VER!)
echo        npm:  !NPM_CMD!
echo        PATH updated: yes
echo  [OK]
echo.

REM --- Step 4: Reinstall dependencies ---
set "FINAL_DIR="
if exist "%M3E_DIR%\final\package.json" set "FINAL_DIR=%M3E_DIR%\final"
if "%FINAL_DIR%"=="" if exist "%M3E_DIR%\app\package.json" set "FINAL_DIR=%M3E_DIR%\app"

if "%FINAL_DIR%"=="" (
  echo  [ERROR] Cannot find package.json in M3E install.
  pause
  exit /b 1
)

echo  [4/4] Reinstalling dependencies...
echo        Target: %FINAL_DIR%
echo.
call "!NPM_CMD!" --prefix "%FINAL_DIR%" ci --legacy-peer-deps
if not !errorlevel! equ 0 (
  echo.
  echo        npm ci failed. Trying npm install...
  call "!NPM_CMD!" --prefix "%FINAL_DIR%" install --legacy-peer-deps
  if not !errorlevel! equ 0 (
    echo  [ERROR] Dependency installation failed.
    echo          Check your internet connection and try again.
    pause
    exit /b 1
  )
)

echo.
echo  =============================================
echo   Patch complete!
echo  =============================================
echo   You can now launch M3E normally.
echo.
pause
exit /b 0
