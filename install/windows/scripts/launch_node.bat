@echo off
setlocal EnableExtensions EnableDelayedExpansion

call "%~dp0..\common_env.bat"
if errorlevel 1 exit /b %errorlevel%

call :ensure_dirs
if errorlevel 1 exit /b %errorlevel%

set "M3E_PORT=%M3E_DEFAULT_PORT%"
set "M3E_DATA_DIR=%M3E_DATA%"
set "M3E_DB_FILE=M3E_dataV1.sqlite"
call :read_conf

call :log_info "Launch start"
call :log_info "App path: %M3E_APP%"

if not exist "%M3E_NODE_EXE%" call :fail 41 "Missing runtime: %M3E_NODE_EXE%"
if not exist "%M3E_START_JS%" call :fail 42 "Missing start script: %M3E_START_JS%"

set "LOCK_PID="
set "LOCK_PORT="
if exist "%M3E_LOCK_FILE%" call :read_lock

if defined LOCK_PID (
  tasklist /FI "PID eq !LOCK_PID!" | find " !LOCK_PID! " >nul 2>&1
  if not errorlevel 1 (
    if not defined LOCK_PORT set "LOCK_PORT=%M3E_PORT%"
    call :probe_port "!LOCK_PORT!"
    if not errorlevel 1 (
      call :log_info "M3E is already running on port !LOCK_PORT!"
      start "" "http://127.0.0.1:!LOCK_PORT!/viewer.html"
      exit /b 0
    )
  )
  call :log_info "Stale lock detected, removing"
  del /q "%M3E_LOCK_FILE%" >nul 2>&1
)

call :select_port "%M3E_PORT%"
if errorlevel 1 call :fail 43 "No available port"
set "M3E_PORT=%SELECTED_PORT%"

set "M3E_DB_FILE=%M3E_DB_FILE%"
set "M3E_DATA_DIR=%M3E_DATA_DIR%"
set "M3E_PORT=%M3E_PORT%"

for /f %%P in ('powershell -NoProfile -ExecutionPolicy Bypass -Command "$p=Start-Process -FilePath '%M3E_NODE_EXE%' -ArgumentList '%M3E_START_JS%' -WorkingDirectory '%M3E_APP%' -WindowStyle Hidden -PassThru; $p.Id"') do set "NODE_PID=%%P"
if not defined NODE_PID call :fail 44 "Failed to start Node process"

> "%M3E_LOCK_FILE%" (
  echo pid=%NODE_PID%
  echo port=%M3E_PORT%
  for /f %%T in ('powershell -NoProfile -Command "Get-Date -Format yyyyMMdd_HHmmss"') do echo startedAt=%%T
)

set /a WAIT_COUNT=0
:wait_server
call :probe_port "%M3E_PORT%"
if not errorlevel 1 goto :server_ready
if %WAIT_COUNT% GEQ 25 goto :server_timeout
set /a WAIT_COUNT+=1
timeout /t 1 /nobreak >nul
goto :wait_server

:server_ready
call :set_conf "M3E_PORT" "%M3E_PORT%"
call :log_info "Server started. PID=%NODE_PID% PORT=%M3E_PORT%"
exit /b 0

:server_timeout
call :log_error "Server did not respond on port %M3E_PORT%"
taskkill /PID %NODE_PID% /T /F >nul 2>&1
del /q "%M3E_LOCK_FILE%" >nul 2>&1
call :fail 45 "Startup timeout"

:ensure_dirs
for %%D in ("%M3E_HOME%" "%M3E_DATA%" "%M3E_LOGS%" "%M3E_BACKUP%" "%M3E_TMP%" "%M3E_REPORTS%") do (
  if not exist "%%~D" mkdir "%%~D"
  if errorlevel 1 exit /b 11
)
if not exist "%M3E_STARTUP_LOG%" type nul > "%M3E_STARTUP_LOG%"
if errorlevel 1 exit /b 12
if not exist "%M3E_FIRST_RUN_MARKER%" type nul > "%M3E_FIRST_RUN_MARKER%"
exit /b 0

:read_conf
if not exist "%M3E_CONF%" (
  > "%M3E_CONF%" (
    echo M3E_DATA_DIR=%M3E_DATA%
    echo M3E_DB_FILE=M3E_dataV1.sqlite
    echo M3E_PORT=%M3E_DEFAULT_PORT%
    echo M3E_HOST=%M3E_HOST%
  )
)
for /f "usebackq tokens=1* delims==" %%A in ("%M3E_CONF%") do (
  if /I "%%~A"=="M3E_PORT" set "M3E_PORT=%%~B"
  if /I "%%~A"=="M3E_DATA_DIR" set "M3E_DATA_DIR=%%~B"
  if /I "%%~A"=="M3E_DB_FILE" set "M3E_DB_FILE=%%~B"
)
if "%M3E_PORT%"=="" set "M3E_PORT=%M3E_DEFAULT_PORT%"
exit /b 0

:read_lock
for /f "usebackq tokens=1* delims==" %%A in ("%M3E_LOCK_FILE%") do (
  if /I "%%~A"=="pid" set "LOCK_PID=%%~B"
  if /I "%%~A"=="port" set "LOCK_PORT=%%~B"
)
exit /b 0

:select_port
set "BASE_PORT=%~1"
if "%BASE_PORT%"=="" set "BASE_PORT=%M3E_DEFAULT_PORT%"
set /a TRY_PORT=%BASE_PORT%
set /a MAX_TRY=40
:port_loop
call :port_in_use "!TRY_PORT!"
if errorlevel 1 (
  set /a TRY_PORT+=1
  set /a MAX_TRY-=1
  if !MAX_TRY! LEQ 0 exit /b 1
  goto :port_loop
)
set "SELECTED_PORT=!TRY_PORT!"
exit /b 0

:port_in_use
netstat -ano | findstr /R /C:":%~1 .*LISTENING" >nul 2>&1
if errorlevel 1 (
  exit /b 0
) else (
  exit /b 1
)

:probe_port
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$client = New-Object System.Net.Sockets.TcpClient;" ^
  "try { $client.Connect('127.0.0.1', %~1); exit 0 } catch { exit 1 } finally { if($client){$client.Dispose()} }" >nul 2>&1
exit /b %errorlevel%

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
exit /b %errorlevel%

:log_info
>> "%M3E_STARTUP_LOG%" echo [%date% %time%] [INFO] %~1
echo [INFO] %~1
exit /b 0

:log_error
>> "%M3E_STARTUP_LOG%" echo [%date% %time%] [ERROR] %~1
echo [ERROR] %~1
exit /b 0

:fail
set "CODE=%~1"
set "MSG=%~2"
call :log_error "%MSG%"
echo Log: %M3E_STARTUP_LOG%
echo For diagnostics run: "%M3E_HOME%\collect_report.bat"
exit /b %CODE%
