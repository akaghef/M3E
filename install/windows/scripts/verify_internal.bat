@echo off
setlocal EnableExtensions EnableDelayedExpansion

call "%~dp0..\common_env.bat"
if errorlevel 1 exit /b %errorlevel%

call :ensure_dirs
if errorlevel 1 exit /b %errorlevel%

call :log_info "Verify start"

call :check_file "%M3E_NODE_EXE%" "runtime node.exe" || call :fail 51 "Missing runtime node.exe"
call :check_file "%M3E_START_JS%" "start_viewer.js" || call :fail 52 "Missing start_viewer.js"
call :check_file "%M3E_APP%\node_modules\better-sqlite3\build\Release\better_sqlite3.node" "better_sqlite3.node" || call :fail 53 "Missing better_sqlite3.node"

call :touch_test "%M3E_DATA%\verify_data.tmp" || call :fail 54 "Data directory is not writable"
call :touch_test "%M3E_LOGS%\verify_logs.tmp" || call :fail 55 "Logs directory is not writable"
call :touch_test "%M3E_TMP%\verify_tmp.tmp" || call :fail 56 "Tmp directory is not writable"

pushd "%M3E_APP%" >nul
"%M3E_NODE_EXE%" -e "require('better-sqlite3'); console.log('better-sqlite3-ok')" >> "%M3E_VERIFY_LOG%" 2>&1
if errorlevel 1 (
  popd >nul
  call :fail 57 "Failed to load better-sqlite3"
)
popd >nul

> "%M3E_TMP%\verify_lock.tmp" (
  echo pid=0
  echo port=%M3E_DEFAULT_PORT%
  echo startedAt=verify
)
if errorlevel 1 call :fail 58 "Failed to write key=value lock"

set "V_PID="
set "V_PORT="
for /f "usebackq tokens=1* delims==" %%A in ("%M3E_TMP%\verify_lock.tmp") do (
  if /I "%%~A"=="pid" set "V_PID=%%~B"
  if /I "%%~A"=="port" set "V_PORT=%%~B"
)
if not "%V_PID%"=="0" call :fail 59 "Lock parse failed (pid)"
if not "%V_PORT%"=="%M3E_DEFAULT_PORT%" call :fail 60 "Lock parse failed (port)"
del /q "%M3E_TMP%\verify_lock.tmp" >nul 2>&1

call :log_info "Verify completed successfully"
echo Verify completed successfully.
exit /b 0

:ensure_dirs
for %%D in ("%M3E_HOME%" "%M3E_DATA%" "%M3E_LOGS%" "%M3E_BACKUP%" "%M3E_TMP%" "%M3E_REPORTS%") do (
  if not exist "%%~D" mkdir "%%~D"
  if errorlevel 1 exit /b 11
)
if not exist "%M3E_VERIFY_LOG%" type nul > "%M3E_VERIFY_LOG%"
if errorlevel 1 exit /b 12
exit /b 0

:check_file
if exist "%~1" (
  call :log_info "FOUND %~2"
  exit /b 0
)
call :log_error "MISSING %~2 (%~1)"
exit /b 1

:touch_test
> "%~1" echo verify
if errorlevel 1 exit /b 1
del /q "%~1" >nul 2>&1
exit /b 0

:log_info
>> "%M3E_VERIFY_LOG%" echo [%date% %time%] [INFO] %~1
echo [INFO] %~1
exit /b 0

:log_error
>> "%M3E_VERIFY_LOG%" echo [%date% %time%] [ERROR] %~1
echo [ERROR] %~1
exit /b 0

:fail
set "CODE=%~1"
set "MSG=%~2"
call :log_error "%MSG%"
echo Log: %M3E_VERIFY_LOG%
echo For diagnostics run: "%M3E_HOME%\collect_report.bat"
exit /b %CODE%
