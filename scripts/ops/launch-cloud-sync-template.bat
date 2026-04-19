@echo off
REM ============================================================
REM M3E Cloud Sync launcher template
REM
REM Usage:
REM   1. Copy this file to launch-cloud-sync.local.bat (git-ignored).
REM   2. Fill in your Supabase URL / anon key below.
REM   3. Toggle M3E_AUTO_SYNC per scenario (0 = manual push/pull, 1 = auto push).
REM   4. Run launch-cloud-sync.local.bat on the host and copy the same values
REM      to the VM launcher (see plan: steady-kindling-floyd.md).
REM
REM scripts\final\launch.bat now loads M3E_CLOUD_* and M3E_SUPABASE_* from
REM %LOCALAPPDATA%\M3E\m3e.conf as well. This template remains useful when
REM you want a local one-shot launcher without persisting settings.
REM ============================================================

setlocal EnableExtensions

set "M3E_CLOUD_SYNC=1"
set "M3E_CLOUD_TRANSPORT=supabase"
set "M3E_SUPABASE_URL=https://YOUR-PROJECT.supabase.co"
set "M3E_SUPABASE_ANON_KEY=eyJ...YOUR_ANON_KEY..."

REM Scenario switches
set "M3E_AUTO_SYNC=0"
set "M3E_AUTO_SYNC_INTERVAL_MS=8000"

call "%~dp0..\final\launch.bat"
endlocal
