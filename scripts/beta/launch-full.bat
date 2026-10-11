@echo off
setlocal
set "M3E_CLOUD_SYNC=1"
set "M3E_COLLAB=1"
if "%M3E_CLOUD_TRANSPORT%"=="" set "M3E_CLOUD_TRANSPORT=file"
if "%M3E_AI_ENABLED%"=="" set "M3E_AI_ENABLED=1"
call "%~dp0launch.bat"
exit /b %errorlevel%
