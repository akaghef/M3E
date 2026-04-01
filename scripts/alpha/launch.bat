@echo off
setlocal

REM ============================================================
REM M3E Alpha: 起動専用スクリプト
REM - Alpha (MVP) は開発停止予定。参照・検証用途のみ。
REM - 更新は行わない（ビルド済みが前提）
REM ============================================================

cd /d "%~dp0\..\.."

call npm --prefix mvp start

if errorlevel 1 (
  echo.
  echo [ERROR] 起動に失敗しました。mvp/ のビルドが完了しているか確認してください。
  pause
  exit /b 1
)

exit /b 0
