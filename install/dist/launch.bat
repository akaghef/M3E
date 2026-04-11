@echo off
setlocal EnableExtensions
call "%~dp0common_env.bat"
if errorlevel 1 exit /b %errorlevel%
call "%~dp0scripts\launch_node.bat" %*
exit /b %errorlevel%
