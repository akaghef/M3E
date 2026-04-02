@echo off
setlocal

REM ============================================================
REM M3E Beta: 起動専用スクリプト
REM - 普段はこのファイルをダブルクリックして使う
REM - 更新は行わない（ビルド済みが前提）
REM ============================================================

cd /d "%~dp0\..\.."

set "M3E_DATA_DIR=%CD%\beta\data"
if not exist "%M3E_DATA_DIR%" mkdir "%M3E_DATA_DIR%"

call npm --prefix beta start

if errorlevel 1 (
  echo.
  echo [ERROR] 起動に失敗しました。beta/ のビルドが完了しているか確認してください。
  echo   初回や依存関係更新後は update-and-launch.bat を使ってください。
  pause
  exit /b 1
)

exit /b 0
