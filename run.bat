@echo off
REM Compatibility entry point; implementation lives in scripts/dev.
call "%~dp0scripts\dev\run.bat" %*
exit /b %errorlevel%
