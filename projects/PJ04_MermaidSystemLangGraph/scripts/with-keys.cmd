@echo off
REM with-keys.cmd — Windows wrapper that delegates to with-keys.sh via bash.
REM Usage: with-keys.cmd python runtime\langgraph_sandbox\smoke_test.py

setlocal
set "SCRIPT_DIR=%~dp0"
bash "%SCRIPT_DIR%with-keys.sh" %*
exit /b %ERRORLEVEL%
