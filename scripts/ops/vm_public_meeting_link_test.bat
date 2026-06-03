@echo off
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0vm_public_meeting_link_test.ps1"
exit /b %ERRORLEVEL%
