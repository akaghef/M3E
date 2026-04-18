@echo off
setlocal EnableExtensions
chcp 65001 >nul 2>&1

if "%~1"=="" goto :usage
if "%~2"=="" goto :usage

set "SUPABASE_URL=%~1"
set "SUPABASE_ANON_KEY=%~2"
set "WORKSPACE_ID=%~3"
set "WORKSPACE_LABEL=%~4"
set "MAP_ID=%~5"
set "MAP_LABEL=%~6"
set "MAP_SLUG=%~7"
set "AUTO_SYNC=%~8"

if "%M3E_HOME%"=="" set "M3E_HOME=%LOCALAPPDATA%\M3E"
set "CONFIG_FILE=%M3E_HOME%\m3e.conf"
if not exist "%M3E_HOME%" mkdir "%M3E_HOME%" >nul 2>&1

if "%WORKSPACE_ID%"=="" set "WORKSPACE_ID=ws_team_workspace"
if "%WORKSPACE_LABEL%"=="" set "WORKSPACE_LABEL=Team Workspace"
if "%MAP_ID%"=="" set "MAP_ID=map_team_home"
if "%MAP_LABEL%"=="" set "MAP_LABEL=team-home"
if "%MAP_SLUG%"=="" set "MAP_SLUG=team-home"
if "%AUTO_SYNC%"=="" set "AUTO_SYNC=0"

(
  echo M3E_LAUNCH_MODE=personal
  echo M3E_WORKSPACE_ID=%WORKSPACE_ID%
  echo M3E_WORKSPACE_LABEL=%WORKSPACE_LABEL%
  echo M3E_MAP_ID=%MAP_ID%
  echo M3E_MAP_LABEL=%MAP_LABEL%
  echo M3E_MAP_SLUG=%MAP_SLUG%
  echo M3E_CLOUD_SYNC=1
  echo M3E_CLOUD_TRANSPORT=supabase
  echo M3E_SUPABASE_URL=%SUPABASE_URL%
  echo M3E_SUPABASE_ANON_KEY=%SUPABASE_ANON_KEY%
  echo M3E_AUTO_SYNC=%AUTO_SYNC%
  echo M3E_AUTO_SYNC_INTERVAL_MS=8000
) > "%CONFIG_FILE%"

echo [configure-cloud-sync-mode] wrote %CONFIG_FILE%
echo [configure-cloud-sync-mode] workspace=%WORKSPACE_ID% map=%MAP_ID% auto_sync=%AUTO_SYNC%
exit /b 0

:usage
echo Usage:
echo   scripts\final\configure-cloud-sync-mode.bat ^<supabase-url^> ^<anon-key^> [workspace-id] [workspace-label] [map-id] [map-label] [map-slug] [auto-sync]
echo Example:
echo   scripts\final\configure-cloud-sync-mode.bat https://YOUR-PROJECT.supabase.co eyJ... ws_team_swingby "Swingby Team" map_team_swingby_home team-home team-home 0
exit /b 1
