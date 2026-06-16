@echo off
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0vm_swingby_conflict_lab.ps1" %*
exit /b %ERRORLEVEL%
