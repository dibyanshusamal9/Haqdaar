@echo off
REM Stops the Haqdaar.ai API, citizen site, curator console and the phone-line tunnel.
cd /d "%~dp0..\.."
set "REPO_ROOT=%CD%"
echo Stopping API, citizen site and console (ports 4000, 3001, 3000)...
for %%P in (4000 3001 3000) do (
  for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":%%P " ^| findstr LISTENING') do taskkill /PID %%p /F >nul 2>&1
)
echo Stopping the phone-line tunnel (cloudflared)...
taskkill /IM cloudflared.exe /F >nul 2>&1
echo Done. (Postgres keeps running; "docker compose down" stops the Docker one.)
