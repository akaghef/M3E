@echo off
setlocal EnableExtensions
chcp 65001 >nul 2>&1

if "%M3E_HOME%"=="" set "M3E_HOME=%LOCALAPPDATA%\M3E"
set "CONFIG_FILE=%M3E_HOME%\m3e.conf"
if not exist "%M3E_HOME%" mkdir "%M3E_HOME%" >nul 2>&1

(
  echo M3E_LAUNCH_MODE=personal
  echo M3E_WORKSPACE_ID=ws_A98E70JM9GAXCVXVMQBW7N0YGZ
  echo M3E_WORKSPACE_LABEL=Personal
  echo M3E_MAP_ID=map_09N0MQPFEQN9D4K66VNMT1F69V
  echo M3E_MAP_LABEL=tutorial
  echo M3E_MAP_SLUG=final-tutorial
  echo M3E_CLOUD_SYNC=0
  echo M3E_AUTO_SYNC=0
) > "%CONFIG_FILE%"

echo [configure-personal-mode] wrote %CONFIG_FILE%
exit /b 0
