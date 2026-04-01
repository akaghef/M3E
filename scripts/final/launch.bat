@echo off
setlocal

REM ============================================================
REM M3E Final: 起動専用スクリプト
REM - 普段はこのファイルをダブルクリックして使う
REM - 更新・migration は migrate-from-beta.bat を使う
REM ============================================================

cd /d "%~dp0\..\.."

call npm --prefix final start

if errorlevel 1 (
  echo.
  echo [ERROR] 起動に失敗しました。
  echo   初回は migrate-from-beta.bat を先に実行してください。
  pause
  exit /b 1
)

exit /b 0
