@echo off
setlocal

REM ============================================================
REM M3E Beta: 更新して起動するスクリプト
REM - 週1回や、最新版を取り込みたい時だけ使う
REM - 失敗したらその場で停止して原因を見やすくする
REM ============================================================

REM 1) リポジトリルートへ移動（このファイルは scripts/mvp 配下）
cd /d "%~dp0\..\.."

echo [1/5] Git fetch...
call git fetch --all
if errorlevel 1 goto :error

echo [2/5] Git pull...
call git pull --ff-only
if errorlevel 1 goto :error

echo [3/5] Install dependencies...
call npm --prefix mvp ci
if errorlevel 1 goto :error

echo [4/5] Build...
call npm --prefix mvp run build
if errorlevel 1 goto :error

echo [5/5] Launch...
call npm --prefix mvp start
if errorlevel 1 goto :error

echo.
echo 完了しました。
exit /b 0

:error
echo.
echo [ERROR] 更新または起動に失敗しました。上のログを確認してください。
pause
exit /b 1

