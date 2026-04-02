@echo off
setlocal

REM ============================================================
REM M3E Beta: 起動専用スクリプト
REM - 普段はこのファイルをダブルクリックして使う
REM - 更新処理は行わない（最速起動）
REM ============================================================

REM 1) リポジトリルートへ移動（このファイルは scripts/mvp 配下）
cd /d "%~dp0\..\.."

REM 2) MVP を起動（ビルド済みが前提）
call npm --prefix mvp start

if errorlevel 1 (
  echo.
  echo [ERROR] 起動に失敗しました。コマンドや依存関係を確認してください。
  pause
  exit /b 1
)

exit /b 0

