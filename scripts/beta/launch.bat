@echo off
setlocal

REM M3E Beta launch script (build must already exist).

cd /d "%~dp0\..\.."

set "M3E_DATA_DIR=%CD%\beta\data"
if not exist "%M3E_DATA_DIR%" mkdir "%M3E_DATA_DIR%"

call :kill_port_4173

call npm --prefix beta start
if errorlevel 1 goto :error

exit /b 0

:kill_port_4173
for /f "tokens=5" %%P in ('netstat -ano ^| findstr :4173 ^| findstr LISTENING') do (
  if not "%%P"=="0" (
    echo Stopping existing process on port 4173 ^(PID %%P^)...
    taskkill /PID %%P /F >nul 2>&1
  )
)
exit /b 0

:error
echo.
echo [ERROR] Launch failed. Check beta build and try again.
echo   Use scripts\beta\update-and-launch.bat after dependency updates.
pause
exit /b 1
