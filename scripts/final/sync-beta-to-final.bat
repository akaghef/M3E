@echo off
setlocal enabledelayedexpansion
REM M3E: Sync beta/ → final/ (source code only, no launch)
REM Usage: scripts\final\sync-beta-to-final.bat
REM
REM Uses robocopy /MIR to mirror exactly (adds new, updates changed, deletes removed).
REM Safe: final-only files (FINAL_POLICY.md etc.) are excluded.
REM Idempotent: running twice produces the same result.

cd /d "%~dp0\..\.."

echo === M3E Sync: beta/ -^> final/ ===

REM --- Directory sync (robocopy /MIR mirrors exactly) ---
echo [1/3] Syncing directories...

REM /MIR = mirror (copy+delete)  /XD = exclude dirs  /XF = exclude files
REM /NFL /NDL /NJH /NJS /NP = quiet output
set "ROBO_OPTS=/MIR /XD node_modules dist backups /XF FINAL_POLICY.md .m3e-launched /NFL /NDL /NJH /NJS /NP"

if exist beta\src (
  robocopy beta\src final\src %ROBO_OPTS% > nul
  echo   src\ done
)
if exist beta\tests (
  robocopy beta\tests final\tests %ROBO_OPTS% > nul
  echo   tests\ done
)
if exist beta\legacy (
  robocopy beta\legacy final\legacy %ROBO_OPTS% > nul
  echo   legacy\ done
)

REM --- Single file sync ---
echo [2/3] Syncing files...
for %%F in (
  viewer.html
  viewer.css
  package.json
  package-lock.json
  tsconfig.browser.json
  tsconfig.node.json
  playwright.config.js
  test_server.js
  vitest.config.js
) do (
  if exist "beta\%%F" (
    copy /Y "beta\%%F" "final\%%F" > nul 2>&1
    echo   %%F done
  )
)

REM --- Demo data ---
echo [3/3] Syncing demo data...
if not exist final\data mkdir final\data
copy /Y beta\data\*.json final\data\ > nul 2>&1
copy /Y beta\data\*.mm final\data\ > nul 2>&1
echo   data\ done

echo.
echo Sync complete. Run 'cd final ^&^& npm install ^&^& npm run build' to build.
exit /b 0
