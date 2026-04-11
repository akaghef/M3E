@echo off
setlocal EnableDelayedExpansion
REM ============================================================
REM Build test package from final/ and install/windows/
REM Places everything in C:\M3E_test_package\ ready for m3e_test
REM
REM Run from repo root as Akaghef.
REM ============================================================

cd /d "%~dp0..\.."
set "PKG=C:\M3E_test_package"

echo === Building M3E test package ===

REM Clean previous
if exist "%PKG%" rmdir /s /q "%PKG%"
mkdir "%PKG%\payload\app" >nul
mkdir "%PKG%\payload\runtime" >nul

REM Distribution scripts (install/dist/)
xcopy /E /I /Y install\dist\* "%PKG%\" >nul
echo [OK] Distribution scripts

REM Installer definitions (install/windows/)
xcopy /E /I /Y install\windows\* "%PKG%\" >nul
echo [OK] Installer definitions

REM App (final build)
xcopy /E /I /Y final\dist "%PKG%\payload\app\dist" >nul
xcopy /E /I /Y final\node_modules "%PKG%\payload\app\node_modules" >nul
copy /Y final\package.json "%PKG%\payload\app\" >nul
copy /Y final\viewer.html "%PKG%\payload\app\" >nul
copy /Y final\viewer.css "%PKG%\payload\app\" >nul
echo [OK] App payload

REM Tutorial data
mkdir "%PKG%\payload\data" >nul 2>&1
if exist "install\assets\tutorial\M3E_dataV1.sqlite" (
  copy /Y "install\assets\tutorial\M3E_dataV1.sqlite" "%PKG%\payload\data\" >nul
  echo [OK] Tutorial data
) else (
  echo [WARN] Tutorial data not found
)

REM Node runtime
for /f "tokens=*" %%N in ('where node') do (
  copy /Y "%%N" "%PKG%\payload\runtime\node.exe" >nul
  echo [OK] Node runtime: %%N
  goto :node_done
)
:node_done

REM Test runner script
copy /Y "%~dp0run_test.bat" "%PKG%\run_test.bat" >nul
echo [OK] Test runner

echo.
echo Package ready: %PKG%
echo Next: runas /user:m3e_test "C:\M3E_test_package\run_test.bat"
