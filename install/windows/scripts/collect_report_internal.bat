@echo off
setlocal EnableExtensions EnableDelayedExpansion

call "%~dp0..\common_env.bat"
if errorlevel 1 exit /b %errorlevel%

set "REPORT_REASON=%~1"
if "%REPORT_REASON%"=="" set "REPORT_REASON=manual"

call :ensure_dirs
if errorlevel 1 exit /b %errorlevel%

for /f %%T in ('powershell -NoProfile -Command "Get-Date -Format yyyyMMdd_HHmmss"') do set "TS=%%T"
if "%TS%"=="" set "TS=%date:~0,4%%date:~5,2%%date:~8,2%_%time:~0,2%%time:~3,2%%time:~6,2%"
set "REPORT_DIR=%M3E_REPORTS%\M3E_report_%TS%"
set "REPORT_ZIP=%M3E_REPORTS%\M3E_report_%TS%.zip"

mkdir "%REPORT_DIR%" >nul 2>&1
mkdir "%REPORT_DIR%\logs" >nul 2>&1
mkdir "%REPORT_DIR%\config" >nul 2>&1
mkdir "%REPORT_DIR%\data" >nul 2>&1

if not exist "%REPORT_DIR%\" call :fail 71 "Failed to create report directory"

call :log_info "Collect report start: %REPORT_DIR%"

call :write_summary
call :write_env
call :write_paths
call :write_process
call :write_network
call :write_files
call :write_errors
call :write_sqlite_info

call :copy_if_exists "%M3E_SETUP_LOG%" "%REPORT_DIR%\logs\setup.log"
call :copy_if_exists "%M3E_STARTUP_LOG%" "%REPORT_DIR%\logs\startup.log"
call :copy_if_exists "%M3E_VERIFY_LOG%" "%REPORT_DIR%\logs\verify.log"
call :copy_if_exists "%M3E_MIGRATION_LOG%" "%REPORT_DIR%\logs\migration.log"
call :copy_if_exists "%M3E_CRASH_LOG%" "%REPORT_DIR%\logs\crash.log"
call :copy_if_exists "%M3E_REPORT_LOG%" "%REPORT_DIR%\logs\report.log"
call :copy_if_exists "%M3E_VERSION_JSON%" "%REPORT_DIR%\config\version.json"
call :copy_if_exists "%M3E_LOCK_FILE%" "%REPORT_DIR%\config\app.lock"

if exist "%M3E_CONF%" (
  powershell -NoProfile -ExecutionPolicy Bypass -Command ^
    "$in=Get-Content -Path '%M3E_CONF%' -ErrorAction Stop;" ^
    "$out=$in -replace '^(?i)(.*(API_KEY|TOKEN|PASSWORD|SECRET).*=).*$','$1***MASKED***';" ^
    "Set-Content -Path '%REPORT_DIR%\config\m3e.conf' -Value $out -Encoding UTF8"
)

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "if(Test-Path '%REPORT_ZIP%'){ Remove-Item -LiteralPath '%REPORT_ZIP%' -Force }" >nul 2>&1

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "Compress-Archive -Path '%REPORT_DIR%\*' -DestinationPath '%REPORT_ZIP%' -Force" >nul 2>&1

if exist "%REPORT_ZIP%" (
  call :log_info "Report zip created: %REPORT_ZIP%"
  echo Report created: %REPORT_ZIP%
  echo Send this zip to the developer.
  exit /b 0
)

call :log_error "Zip creation failed, fallback to directory"
echo Zip creation failed. Send this directory to the developer:
echo %REPORT_DIR%
exit /b 0

:ensure_dirs
for %%D in ("%M3E_HOME%" "%M3E_DATA%" "%M3E_LOGS%" "%M3E_BACKUP%" "%M3E_TMP%" "%M3E_REPORTS%") do (
  if not exist "%%~D" mkdir "%%~D"
  if errorlevel 1 exit /b 11
)
if not exist "%M3E_REPORT_LOG%" type nul > "%M3E_REPORT_LOG%"
if errorlevel 1 exit /b 12
exit /b 0

:write_summary
> "%REPORT_DIR%\summary.txt" (
  echo M3E Diagnostic Report
  echo createdAt=%date% %time%
  echo reason=%REPORT_REASON%
  echo reportDir=%REPORT_DIR%
  echo reportZip=%REPORT_ZIP%
  echo sendToDeveloper=1
)
exit /b 0

:write_env
> "%REPORT_DIR%\env.txt" (
  echo ComputerName=%COMPUTERNAME%
  echo UserName=%USERNAME%
  echo LocalAppData=%LOCALAPPDATA%
  echo ProcessorArch=%PROCESSOR_ARCHITECTURE%
  ver
)
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$os=Get-CimInstance Win32_OperatingSystem;" ^
  "'OSCaption='+$os.Caption | Out-File -FilePath '%REPORT_DIR%\env.txt' -Append -Encoding utf8;" ^
  "'OSVersion='+$os.Version | Out-File -FilePath '%REPORT_DIR%\env.txt' -Append -Encoding utf8;" ^
  "'OSBuild='+$os.BuildNumber | Out-File -FilePath '%REPORT_DIR%\env.txt' -Append -Encoding utf8;" ^
  "'MemoryMB='+[int]($os.TotalVisibleMemorySize/1024) | Out-File -FilePath '%REPORT_DIR%\env.txt' -Append -Encoding utf8" >nul 2>&1
exit /b 0

:write_paths
> "%REPORT_DIR%\paths.txt" (
  echo M3E_HOME=%M3E_HOME%
  echo M3E_RUNTIME=%M3E_RUNTIME%
  echo M3E_APP=%M3E_APP%
  echo M3E_DATA=%M3E_DATA%
  echo M3E_LOGS=%M3E_LOGS%
  echo M3E_BACKUP=%M3E_BACKUP%
  echo M3E_TMP=%M3E_TMP%
  echo M3E_REPORTS=%M3E_REPORTS%
  echo M3E_NODE_EXE=%M3E_NODE_EXE%
  echo M3E_START_JS=%M3E_START_JS%
  echo M3E_DB=%M3E_DB%
)
exit /b 0

:write_process
tasklist /v > "%REPORT_DIR%\process_all.txt" 2>nul
findstr /I "node.exe start_viewer.js" "%REPORT_DIR%\process_all.txt" > "%REPORT_DIR%\process.txt" 2>nul
del /q "%REPORT_DIR%\process_all.txt" >nul 2>&1
if exist "%M3E_LOCK_FILE%" (
  echo.>> "%REPORT_DIR%\process.txt"
  echo [lock]>> "%REPORT_DIR%\process.txt"
  type "%M3E_LOCK_FILE%" >> "%REPORT_DIR%\process.txt"
)
exit /b 0

:write_network
netstat -ano > "%REPORT_DIR%\network_all.txt" 2>nul
findstr /I "LISTENING" "%REPORT_DIR%\network_all.txt" > "%REPORT_DIR%\network.txt" 2>nul
del /q "%REPORT_DIR%\network_all.txt" >nul 2>&1
if exist "%M3E_CONF%" (
  for /f "usebackq tokens=1* delims==" %%A in ("%M3E_CONF%") do (
    if /I "%%~A"=="M3E_PORT" echo ConfigPort=%%~B>> "%REPORT_DIR%\network.txt"
  )
)
exit /b 0

:write_files
> "%REPORT_DIR%\files.txt" (
  if exist "%M3E_NODE_EXE%" (echo runtime_node=FOUND) else (echo runtime_node=MISSING)
  if exist "%M3E_START_JS%" (echo start_viewer=FOUND) else (echo start_viewer=MISSING)
  if exist "%M3E_APP%\node_modules\better-sqlite3\build\Release\better_sqlite3.node" (echo better_sqlite3=FOUND) else (echo better_sqlite3=MISSING)
  if exist "%M3E_DB%" (echo sqlite_db=FOUND) else (echo sqlite_db=MISSING)
  if exist "%M3E_CONF%" (echo conf=FOUND) else (echo conf=MISSING)
)
exit /b 0

:write_errors
if exist "%M3E_SETUP_LOG%" type "%M3E_SETUP_LOG%" > "%REPORT_DIR%\all_logs.tmp"
if exist "%M3E_STARTUP_LOG%" type "%M3E_STARTUP_LOG%" >> "%REPORT_DIR%\all_logs.tmp"
if exist "%M3E_VERIFY_LOG%" type "%M3E_VERIFY_LOG%" >> "%REPORT_DIR%\all_logs.tmp"
if exist "%M3E_MIGRATION_LOG%" type "%M3E_MIGRATION_LOG%" >> "%REPORT_DIR%\all_logs.tmp"
if exist "%M3E_CRASH_LOG%" type "%M3E_CRASH_LOG%" >> "%REPORT_DIR%\all_logs.tmp"
if exist "%REPORT_DIR%\all_logs.tmp" (
  findstr /I "EPERM EADDRINUSE SQLITE_BUSY MODULE_NOT_FOUND Cannot find failed error" "%REPORT_DIR%\all_logs.tmp" > "%REPORT_DIR%\errors.txt" 2>nul
  del /q "%REPORT_DIR%\all_logs.tmp" >nul 2>&1
) else (
  > "%REPORT_DIR%\errors.txt" echo no_logs_found=1
)
exit /b 0

:write_sqlite_info
> "%REPORT_DIR%\data\sqlite_info.txt" (
  if exist "%M3E_DB%" (
    echo sqlite.exists=1
    for %%F in ("%M3E_DB%") do (
      echo sqlite.size=%%~zF
      echo sqlite.modified=%%~tF
    )
  ) else (
    echo sqlite.exists=0
  )
)
exit /b 0

:copy_if_exists
if exist "%~1" copy /y "%~1" "%~2" >nul
exit /b 0

:log_info
>> "%M3E_REPORT_LOG%" echo [%date% %time%] [INFO] %~1
echo [INFO] %~1
exit /b 0

:log_error
>> "%M3E_REPORT_LOG%" echo [%date% %time%] [ERROR] %~1
echo [ERROR] %~1
exit /b 0

:fail
set "CODE=%~1"
set "MSG=%~2"
call :log_error "%MSG%"
echo Log: %M3E_REPORT_LOG%
exit /b %CODE%
