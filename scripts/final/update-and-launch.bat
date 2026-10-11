@echo off
setlocal
node "%~dp0..\ops\channel-runtime.mjs" update-final "%~dp0..\.." %*
if errorlevel 1 exit /b 1
exit /b 0
