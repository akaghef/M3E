@echo off
setlocal EnableExtensions

call "%~dp0..\common_env.bat"
if errorlevel 1 exit /b %errorlevel%

if not exist "%M3E_LOGS%" mkdir "%M3E_LOGS%" >nul 2>&1

>> "%M3E_STARTUP_LOG%" echo [%date% %time%] [INFO] Launch requested

if not exist "%M3E_NODE_EXE%" (
  >> "%M3E_STARTUP_LOG%" echo [%date% %time%] [ERROR] Missing runtime: %M3E_NODE_EXE%
  echo [ERROR] Missing runtime: %M3E_NODE_EXE%
  echo Please re-run setup.
  exit /b 61
)

if not exist "%M3E_START_JS%" (
  >> "%M3E_STARTUP_LOG%" echo [%date% %time%] [ERROR] Missing start_viewer.js: %M3E_START_JS%
  echo [ERROR] Missing start_viewer.js: %M3E_START_JS%
  echo Please re-run setup.
  exit /b 62
)

pushd "%M3E_APP%" >nul
start "" /B "%M3E_NODE_EXE%" "%M3E_START_JS%" %*
popd >nul

exit /b 0
