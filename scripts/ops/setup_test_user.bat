@echo off
setlocal EnableDelayedExpansion
REM ============================================================
REM Setup: Create m3e_test local user for distribution testing
REM
REM Run this ONCE as Administrator.
REM Creates m3e_test user and a shared report folder.
REM ============================================================

echo === M3E Test User Setup ===

REM Check admin
net session >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Run as Administrator.
  pause
  exit /b 1
)

REM Create user (password: M3eTest2026!)
net user m3e_test "M3eTest2026!" /add /comment:"M3E distribution test user" >nul 2>&1
if errorlevel 1 (
  echo [INFO] User m3e_test may already exist, continuing...
) else (
  echo [OK] Created user: m3e_test
)

REM Create shared report directory accessible by both users
set "SHARED_REPORTS=C:\M3E_test_reports"
if not exist "%SHARED_REPORTS%" mkdir "%SHARED_REPORTS%"
icacls "%SHARED_REPORTS%" /grant "m3e_test:(OI)(CI)F" >nul 2>&1
icacls "%SHARED_REPORTS%" /grant "%USERNAME%:(OI)(CI)F" >nul 2>&1
echo [OK] Shared report dir: %SHARED_REPORTS%

echo.
echo Done. Now:
echo   1. Copy test package to C:\M3E_test_package\
echo   2. Run: runas /user:m3e_test "C:\M3E_test_package\run_test.bat"
echo   3. Check results in %SHARED_REPORTS%\
pause
