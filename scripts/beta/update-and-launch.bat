@echo off
setlocal

REM ============================================================
REM M3E Beta: 更新して起動するスクリプト
REM - コードの更新を取り込みたい時や、初回セットアップ時に使う
REM - 失敗したらその場で停止して原因を見やすくする
REM ============================================================

cd /d "%~dp0\..\.."

set "M3E_DATA_DIR=%CD%\beta\data"
if not exist "%M3E_DATA_DIR%" mkdir "%M3E_DATA_DIR%"

echo [1/5] Git fetch...
call git fetch --all
if errorlevel 1 goto :error

echo [2/5] Git pull...
call git pull --ff-only
if errorlevel 1 goto :error

echo [3/5] Install dependencies (beta)...
call npm --prefix beta ci
if errorlevel 1 goto :error

echo [4/5] Build (beta)...
call npm --prefix beta run build
if errorlevel 1 goto :error

echo [5/5] Launch...
call npm --prefix beta start
if errorlevel 1 goto :error

echo.
echo 完了しました。
exit /b 0

:error
echo.
echo [ERROR] 更新または起動に失敗しました。上のログを確認してください。
pause
exit /b 1
