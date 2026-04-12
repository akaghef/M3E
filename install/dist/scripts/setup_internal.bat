@echo off
setlocal EnableExtensions EnableDelayedExpansion

call "%~dp0..\common_env.bat"
if errorlevel 1 exit /b %errorlevel%

set "CREATE_DESKTOP_SHORTCUT=0"
set "RUN_VERIFY=1"

:parse_args
if "%~1"=="" goto :args_done
if /I "%~1"=="--desktop" set "CREATE_DESKTOP_SHORTCUT=1" & shift & goto :parse_args
if /I "%~1"=="--no-verify" set "RUN_VERIFY=0" & shift & goto :parse_args
if /I "%~1"=="--help" goto :usage
shift
goto :parse_args

:args_done
if not defined M3E_PACKAGE_ROOT (
  echo [ERROR] setup.bat must run from install package root.
  exit /b 2
)

call :ensure_dirs
if errorlevel 1 exit /b %errorlevel%

call :log_info "============================================================"
call :log_info "M3E setup start"
call :log_info "Package root: %M3E_PACKAGE_ROOT%"
call :log_info "Install home: %M3E_HOME%"
call :log_info "============================================================"

if not exist "%M3E_PAYLOAD_RUNTIME%\node.exe" (
  call :fail 21 "Missing payload runtime: %M3E_PAYLOAD_RUNTIME%\node.exe"
)
if not exist "%M3E_PAYLOAD_APP%\dist\node\start_viewer.js" (
  call :fail 22 "Missing payload app: %M3E_PAYLOAD_APP%\dist\node\start_viewer.js"
)

if exist "%M3E_HOME%\scripts\stop_running.bat" (
  call :log_info "Stopping existing M3E process if running"
  call "%M3E_HOME%\scripts\stop_running.bat" --wait 20 >> "%M3E_SETUP_LOG%" 2>&1
  if errorlevel 1 call :fail 23 "Failed to stop running process"
)

if exist "%M3E_RUNTIME%" (
  call :log_info "Removing existing runtime directory"
  rmdir /s /q "%M3E_RUNTIME%" >> "%M3E_SETUP_LOG%" 2>&1
)
if exist "%M3E_APP%" (
  call :log_info "Removing existing app directory"
  rmdir /s /q "%M3E_APP%" >> "%M3E_SETUP_LOG%" 2>&1
)

call :copy_tree "%M3E_PAYLOAD_RUNTIME%" "%M3E_RUNTIME%"
if errorlevel 1 call :fail 24 "Runtime copy failed"

call :copy_tree "%M3E_PAYLOAD_APP%" "%M3E_APP%"
if errorlevel 1 call :fail 25 "App copy failed"

if exist "%M3E_PAYLOAD_SCRIPTS%\" (
  call :copy_tree "%M3E_PAYLOAD_SCRIPTS%" "%M3E_HOME%\scripts"
  if errorlevel 1 call :fail 26 "Payload scripts copy failed"
)

REM Copy tutorial data on first install (if no DB exists yet)
set "M3E_PAYLOAD_DATA=%M3E_PAYLOAD%\data"
if exist "%M3E_PAYLOAD_DATA%\M3E_dataV1.sqlite" (
  if not exist "%M3E_DB%" (
    call :log_info "Copying tutorial data (first install)"
    copy /y "%M3E_PAYLOAD_DATA%\M3E_dataV1.sqlite" "%M3E_DB%" >nul
    if errorlevel 1 call :fail 29 "Tutorial data copy failed"
  )
)

REM Add firewall rule for Node.js (requires admin, silently skipped if not)
if exist "%M3E_RUNTIME%\node.exe" (
  netsh advfirewall firewall delete rule name="M3E Node" >nul 2>&1
  netsh advfirewall firewall add rule name="M3E Node" dir=in action=allow program="%M3E_RUNTIME%\node.exe" enable=yes >nul 2>&1
  if not errorlevel 1 (
    call :log_info "Firewall rule added for Node.js"
  )
)

for %%F in (common_env.bat launch.bat verify.bat collect_report.bat) do (
  if exist "%M3E_PACKAGE_ROOT%\%%F" (
    copy /y "%M3E_PACKAGE_ROOT%\%%F" "%M3E_HOME%\%%F" >nul
    if errorlevel 1 call :fail 27 "Failed to copy %%F"
  )
)

if exist "%M3E_PACKAGE_ROOT%\scripts\" (
  call :copy_tree "%M3E_PACKAGE_ROOT%\scripts" "%M3E_HOME%\scripts"
  if errorlevel 1 call :fail 28 "Failed to copy scripts directory"
)

if not exist "%M3E_CONF%" (
  call :log_info "Creating m3e.conf"
  > "%M3E_CONF%" (
    echo M3E_DATA_DIR=%M3E_DATA%
    echo M3E_DB_FILE=M3E_dataV1.sqlite
    echo M3E_PORT=%M3E_DEFAULT_PORT%
    echo M3E_HOST=%M3E_HOST%
  )
  if errorlevel 1 call :fail 29 "Failed to create m3e.conf"
)

call :set_conf "M3E_DATA_DIR" "%M3E_DATA%"
call :set_conf "M3E_DB_FILE" "M3E_dataV1.sqlite"
call :set_conf "M3E_PORT" "%M3E_DEFAULT_PORT%"
call :set_conf "M3E_HOST" "%M3E_HOST%"
if errorlevel 1 call :fail 30 "Failed to update m3e.conf"

if exist "%M3E_MANIFEST%" (
  copy /y "%M3E_MANIFEST%" "%M3E_VERSION_JSON%" >nul
  if errorlevel 1 call :fail 31 "Failed to copy version manifest"
) else (
  > "%M3E_VERSION_JSON%" (
    echo {"app":{"version":"unknown"},"generatedAt":"%date% %time%"}
  )
)

call :create_start_menu_shortcut
if errorlevel 1 call :fail 32 "Failed to create Start Menu shortcut"

if "%CREATE_DESKTOP_SHORTCUT%"=="1" (
  call :create_desktop_shortcut
  if errorlevel 1 call :fail 33 "Failed to create Desktop shortcut"
)

if "%RUN_VERIFY%"=="1" (
  call :log_info "Running verify.bat"
  call "%M3E_HOME%\verify.bat" --post-setup >> "%M3E_SETUP_LOG%" 2>&1
  if errorlevel 1 call :fail 34 "verify.bat failed"
)

call :log_info "Setup completed successfully"
echo Setup completed successfully.
exit /b 0

:usage
echo Usage: setup.bat [--desktop] [--no-verify]
exit /b 0

:ensure_dirs
for %%D in ("%M3E_HOME%" "%M3E_DATA%" "%M3E_LOGS%" "%M3E_BACKUP%" "%M3E_TMP%" "%M3E_REPORTS%") do (
  if not exist "%%~D" mkdir "%%~D"
  if errorlevel 1 exit /b 11
)
if not exist "%M3E_SETUP_LOG%" type nul > "%M3E_SETUP_LOG%"
if errorlevel 1 exit /b 12
exit /b 0

:copy_tree
set "SRC=%~1"
set "DST=%~2"
if not exist "%SRC%\" exit /b 1
if not exist "%DST%" mkdir "%DST%"
xcopy "%SRC%\*" "%DST%\" /E /I /Y /Q >nul
if errorlevel 1 exit /b 1
exit /b 0

:set_conf
set "CONF_KEY=%~1"
set "CONF_VAL=%~2"
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$path='%M3E_CONF%'; $k='%CONF_KEY%'; $v='%CONF_VAL%';" ^
  "$lines=@(); if(Test-Path $path){$lines=Get-Content -Path $path -ErrorAction Stop};" ^
  "$updated=$false; $out=@();" ^
  "foreach($line in $lines){ if($line -match ('^'+[regex]::Escape($k)+'=')){ $out += ($k+'='+$v); $updated=$true } else { $out += $line }}" ^
  "if(-not $updated){ $out += ($k+'='+$v) }" ^
  "Set-Content -Path $path -Value $out -Encoding UTF8"
if errorlevel 1 exit /b 1
exit /b 0

:create_start_menu_shortcut
set "START_MENU_DIR=%APPDATA%\Microsoft\Windows\Start Menu\Programs\M3E"
if not exist "%START_MENU_DIR%" mkdir "%START_MENU_DIR%"
set "SHORTCUT_PATH=%START_MENU_DIR%\M3E.lnk"
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ws=New-Object -ComObject WScript.Shell;" ^
  "$sc=$ws.CreateShortcut('%SHORTCUT_PATH%');" ^
  "$sc.TargetPath='%M3E_HOME%\launch.bat';" ^
  "$sc.WorkingDirectory='%M3E_HOME%';" ^
  "$sc.Description='M3E';" ^
  "$sc.Save()"
if errorlevel 1 exit /b 1
exit /b 0

:create_desktop_shortcut
for /f "usebackq tokens=*" %%D in (`powershell -NoProfile -Command "[Environment]::GetFolderPath('Desktop')"`) do set "DESKTOP_DIR=%%D"
if "%DESKTOP_DIR%"=="" exit /b 1
set "SHORTCUT_PATH=%DESKTOP_DIR%\M3E.lnk"
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ws=New-Object -ComObject WScript.Shell;" ^
  "$sc=$ws.CreateShortcut('%SHORTCUT_PATH%');" ^
  "$sc.TargetPath='%M3E_HOME%\launch.bat';" ^
  "$sc.WorkingDirectory='%M3E_HOME%';" ^
  "$sc.Description='M3E';" ^
  "$sc.Save()"
if errorlevel 1 exit /b 1
exit /b 0

:log_info
>> "%M3E_SETUP_LOG%" echo [%date% %time%] [INFO] %~1
echo [INFO] %~1
exit /b 0

:fail
set "CODE=%~1"
set "MSG=%~2"
>> "%M3E_SETUP_LOG%" echo [%date% %time%] [ERROR] %MSG%
echo [ERROR] %MSG%
echo Log: %M3E_SETUP_LOG%
echo For diagnostics run: "%M3E_HOME%\collect_report.bat"
exit /b %CODE%
