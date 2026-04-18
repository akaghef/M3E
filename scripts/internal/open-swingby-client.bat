@echo off
setlocal EnableDelayedExpansion

REM Member launcher: opens the shared Swingby server in the default browser.
REM Members do not run local DB/server; they only join the remote workspace.

if "%M3E_SWINGBY_BASE_URL%"=="" set "M3E_SWINGBY_BASE_URL=http://127.0.0.1:4173"
set "WORKSPACE_ID=ws_team_swingby"
set "MAP_ID=map_team_swingby_home"

set "BASE=%M3E_SWINGBY_BASE_URL%"
if "%BASE:~-1%"=="/" set "BASE=%BASE:~0,-1%"
set "URL=%BASE%/viewer.html?ws=%WORKSPACE_ID%&map=%MAP_ID%"

echo [swingby-client] Opening %URL%
start "" "%URL%"
exit /b 0
