@echo off
setlocal

REM ============================================================
REM M3E Final: 更新して起動するスクリプト
REM - Final の更新は Beta からの migration を正式経路とする
REM - 実処理は migrate-from-beta.bat に委譲
REM ============================================================

cd /d "%~dp0"
call migrate-from-beta.bat
exit /b %errorlevel%
