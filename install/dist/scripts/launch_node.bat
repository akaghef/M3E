@echo off
setlocal EnableExtensions EnableDelayedExpansion

call "%~dp0..\common_env.bat"
if errorlevel 1 exit /b %errorlevel%

REM --- Read m3e.conf (key=value) into environment ---
set "M3E_DATA_DIR=%M3E_MAIN_DATA%"
set "M3E_DB_FILE=%M3E_MAIN_DB_FILE%"
set "M3E_DOC_ID=%M3E_MAIN_DOC_ID%"
set "M3E_WORKSPACE_ID=%M3E_MAIN_WORKSPACE_ID%"
set "M3E_SEED_DB_PATH=%M3E_SEED_DB%"
set "M3E_PORT=%M3E_DEFAULT_PORT%"
set "M3E_HOST=%M3E_HOST%"

if exist "%M3E_CONF%" (
  for /f "usebackq tokens=1,* delims==" %%K in ("%M3E_CONF%") do (
    if not "%%K"=="" if not "%%L"=="" (
      set "%%K=%%L"
    )
  )
)

if not exist "%M3E_DATA_DIR%" mkdir "%M3E_DATA_DIR%"
for %%D in ("%M3E_SEED_DB_PATH%") do if not exist "%%~dpD" mkdir "%%~dpD" >nul 2>&1
if not exist "%M3E_SEED_DB_PATH%" (
  set "PACKAGED_SEED=%~dp0..\..\assets\seeds\core-seed.sqlite"
  if exist "!PACKAGED_SEED!" copy /Y "!PACKAGED_SEED!" "%M3E_SEED_DB_PATH%" >nul
)
if not exist "%M3E_DATA_DIR%\%M3E_DB_FILE%" (
  if exist "%M3E_SEED_DB_PATH%" copy /Y "%M3E_SEED_DB_PATH%" "%M3E_DATA_DIR%\%M3E_DB_FILE%" >nul
)

REM --- Validate ---
if not exist "%M3E_NODE_EXE%" (
  echo [ERROR] Node runtime not found: %M3E_NODE_EXE%
  exit /b 1
)
if not exist "%M3E_START_JS%" (
  echo [ERROR] App not found: %M3E_START_JS%
  exit /b 1
)

REM --- Launch ---
set "M3E_DATA_DIR=%M3E_DATA_DIR%"
set "M3E_DB_FILE=%M3E_DB_FILE%"
set "M3E_DOC_ID=%M3E_DOC_ID%"
set "M3E_WORKSPACE_ID=%M3E_WORKSPACE_ID%"
set "M3E_PORT=%M3E_PORT%"
set "M3E_HOST=%M3E_HOST%"

echo [M3E] Starting server on %M3E_HOST%:%M3E_PORT%
echo [M3E] Data: %M3E_DATA_DIR%\%M3E_DB_FILE%

"%M3E_NODE_EXE%" "%M3E_START_JS%"
exit /b %errorlevel%
