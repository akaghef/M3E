@echo off
setlocal EnableExtensions

call "%~dp0..\common_env.bat"
if errorlevel 1 exit /b %errorlevel%

if not exist "%M3E_LOGS%" mkdir "%M3E_LOGS%" >nul 2>&1
if not exist "%M3E_BACKUP%" mkdir "%M3E_BACKUP%" >nul 2>&1

>> "%M3E_MIGRATION_LOG%" echo [%date% %time%] [INFO] migrate_db start

if not exist "%M3E_DB%" (
  >> "%M3E_MIGRATION_LOG%" echo [%date% %time%] [INFO] no database; skip
  exit /b 0
)

for /f %%T in ('powershell -NoProfile -Command "Get-Date -Format yyyyMMdd_HHmmss"') do set "TS=%%T"
set "BACKUP_FILE=%M3E_BACKUP%\pre_migration_%TS%.sqlite"
copy /y "%M3E_DB%" "%BACKUP_FILE%" >nul
if errorlevel 1 (
  >> "%M3E_MIGRATION_LOG%" echo [%date% %time%] [ERROR] backup failed
  exit /b 1
)

if exist "%M3E_APP%\dist\node\migrate.js" (
  pushd "%M3E_APP%" >nul
  "%M3E_NODE_EXE%" "%M3E_APP%\dist\node\migrate.js" >> "%M3E_MIGRATION_LOG%" 2>&1
  set "RC=%errorlevel%"
  popd >nul
  if not "%RC%"=="0" (
    copy /y "%BACKUP_FILE%" "%M3E_DB%" >nul
    >> "%M3E_MIGRATION_LOG%" echo [%date% %time%] [ERROR] migration failed, rollback done
    exit /b %RC%
  )
)

>> "%M3E_MIGRATION_LOG%" echo [%date% %time%] [INFO] migrate_db done
exit /b 0
