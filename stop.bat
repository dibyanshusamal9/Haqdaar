@echo off
REM Compatibility entry point; implementation lives in scripts/dev.
call "%~dp0scripts\dev\stop.bat" %*
exit /b %errorlevel%
