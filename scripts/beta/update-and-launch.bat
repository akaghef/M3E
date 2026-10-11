@echo off
setlocal
node "%~dp0..\ops\channel-runtime.mjs" update-beta "%~dp0..\.." %*
if errorlevel 1 exit /b 1
call "%~dp0launch.bat"
exit /b %errorlevel%
