@echo off
setlocal

REM ============================================================
REM M3E Alpha: 更新して起動するスクリプト
REM - Alpha は開発停止予定のため、通常は launch.bat を使う
REM - このスクリプトは初回セットアップ時のみ推奨
REM ============================================================

cd /d "%~dp0\..\.."

echo [1/4] Git pull...
call git pull --ff-only
if errorlevel 1 goto :error

echo [2/4] Install dependencies (alpha/mvp)...
call npm --prefix mvp ci
if errorlevel 1 goto :error

echo [3/4] Build (alpha/mvp)...
call npm --prefix mvp run build
if errorlevel 1 goto :error

echo [4/4] Launch...
call npm --prefix mvp start
if errorlevel 1 goto :error

exit /b 0

:error
echo.
echo [ERROR] 失敗しました。上のログを確認してください。
pause
exit /b 1
