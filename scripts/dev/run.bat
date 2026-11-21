@echo off
REM ============================================================
REM  Haqdaar.ai: one-click launcher (Windows)
REM
REM  Starts everything, from the database to the phone line:
REM    PostgreSQL       localhost:5433 (if it is not running)
REM    API              http://localhost:4000/api
REM    Citizen site     http://localhost:3001
REM    Curator console  http://localhost:3000
REM    Phone line       Cloudflare tunnel -> Exotel Voicebot
REM
REM  Optional settings in .env:
REM    HAQDAAR_PG_DIR         folder of the local PostgreSQL install
REM                           (the one with bin\pg_ctl.exe and data\)
REM    EXOTEL_FLOW_EDIT_URL   the Exotel flow editor page, opened at
REM                           the end so the new tunnel URL can be pasted
REM ============================================================
setlocal EnableDelayedExpansion
cd /d "%~dp0..\.."
set "REPO_ROOT=%CD%"

where node >nul 2>&1 || (echo   ! node not found in PATH & goto :fail)
where pnpm >nul 2>&1 || (echo   ! pnpm not found in PATH & goto :fail)
if not exist .env (
  echo   ! .env not found. Copy .env.example to .env and fill it in.
  goto :fail
)

call :env HAQDAAR_PG_DIR PG_DIR
if not defined PG_DIR set "PG_DIR=%USERPROFILE%\Desktop\Dibyanshu\Projects\SIH 2026\SIH2026\tools\pgsql"
call :env EXOTEL_FLOW_EDIT_URL FLOW_URL

echo === [1/6] Database ===
netstat -ano | findstr ":5433 " | findstr LISTENING >nul
if errorlevel 1 (
  if exist "%PG_DIR%\bin\pg_ctl.exe" (
    echo   Starting PostgreSQL from "%PG_DIR%" ...
    "%PG_DIR%\bin\pg_ctl.exe" -D "%PG_DIR%\data" -l "%PG_DIR%\server.log" -o "-p 5433" -W start >nul
    netstat -ano | findstr ":5433 " | findstr LISTENING >nul || (echo   ! PostgreSQL did not start. See "%PG_DIR%\server.log". & goto :fail)
  ) else (
    echo   ! PostgreSQL is not running on port 5433 and was not found at "%PG_DIR%".
    echo     Set HAQDAAR_PG_DIR in .env, or run "docker compose up -d".
    goto :fail
  )
) else (
  echo   PostgreSQL already running.
)

echo === [2/6] API dependencies and build ===
pushd apps\api
if not exist node_modules call npm install || (popd & goto :fail)
call npm run build || (popd & goto :fail)
echo === [3/6] Database migrations ===
call npm run migrate || (popd & goto :fail)
popd

echo === [4/6] Web dependencies (first run only) ===
if not exist apps\caller-site\node_modules (pushd apps\caller-site & call npm install & popd)
if not exist apps\web\node_modules (pushd apps\web & call pnpm install & popd)

echo === [5/6] Starting the API and both websites ===
for %%P in (4000 3001 3000) do (
  for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":%%P " ^| findstr LISTENING') do taskkill /PID %%p /F >nul 2>&1
)
start "Haqdaar API" cmd /k "cd /d "%REPO_ROOT%\apps\api" && npm start"
start "Haqdaar citizen site" cmd /k "cd /d "%REPO_ROOT%\apps\caller-site" && npx next dev -p 3001"
start "Haqdaar curator console" cmd /k "cd /d "%REPO_ROOT%\apps\web" && pnpm dev"

echo === [6/6] Phone line (Cloudflare tunnel for Exotel) ===
set "CF="
for /f "delims=" %%c in ('where cloudflared 2^>nul') do if not defined CF set "CF=%%c"
if not defined CF if exist "%ProgramFiles(x86)%\cloudflared\cloudflared.exe" set "CF=%ProgramFiles(x86)%\cloudflared\cloudflared.exe"
if not defined CF if exist "%ProgramFiles%\cloudflared\cloudflared.exe" set "CF=%ProgramFiles%\cloudflared\cloudflared.exe"
if not defined CF if exist "%LOCALAPPDATA%\Microsoft\WinGet\Links\cloudflared.exe" set "CF=%LOCALAPPDATA%\Microsoft\WinGet\Links\cloudflared.exe"
if not defined CF (
  echo   ! cloudflared is not installed, so the phone line is off. Install it once with:
  echo       winget install --id Cloudflare.cloudflared -e
  goto :ready
)
REM A tunnel left running by an earlier run keeps its address, so Exotel needs no change:
REM reuse it. Otherwise start a new one (it gets a new address).
set "HOST="
for /f "delims=" %%h in ('powershell -NoProfile -Command "try { (Invoke-RestMethod http://127.0.0.1:20241/quicktunnel -TimeoutSec 2).hostname } catch {}" 2^>nul') do set "HOST=%%h"
if defined HOST (
  echo   Reusing the running tunnel; the Exotel URL stays the same.
  set "REUSED=1"
  goto :tunnel_ready
)
set "REUSED="
taskkill /IM cloudflared.exe /F >nul 2>&1
start "Haqdaar phone line (Cloudflare tunnel)" cmd /k ""%CF%" tunnel --no-autoupdate --metrics 127.0.0.1:20241 --url http://localhost:4000"

echo   Waiting for the tunnel address...
for /l %%i in (1,1,30) do (
  if not defined HOST (
    timeout /t 2 /nobreak >nul
    for /f "delims=" %%h in ('powershell -NoProfile -Command "try { (Invoke-RestMethod http://127.0.0.1:20241/quicktunnel -TimeoutSec 2).hostname } catch {}" 2^>nul') do set "HOST=%%h"
  )
)
if not defined HOST (
  echo   ! The tunnel did not report an address. Check the "Haqdaar phone line" window.
  goto :ready
)
:tunnel_ready
set "VOICEBOT_URL=wss://%HOST%/exotel/voicebot?sample-rate=16000"
> "%REPO_ROOT%\phone-line-url.txt" echo %VOICEBOT_URL%
<nul set /p "=%VOICEBOT_URL%" | clip
echo.
echo   Phone line URL (copied to the clipboard, also in phone-line-url.txt):
echo     %VOICEBOT_URL%
if defined REUSED goto :ready
echo   This is a NEW address. In Exotel, open the "Haqdaar Helpline" flow, paste
echo   it into the Voicebot URL field, and Save. (stop.bat ends the tunnel; leave it
echo   running between restarts to keep the same address.)
if defined FLOW_URL start "" "%FLOW_URL%"

:ready
echo.
echo   Ready in a few seconds:
echo     Citizen site     http://localhost:3001
echo     Curator console  http://localhost:3000
echo     API health       http://localhost:4000/api/health
timeout /t 6 /nobreak >nul
rundll32 url.dll,FileProtocolHandler http://localhost:3001
goto :eof

REM ---- reads KEY from .env into VAR (value up to an inline # comment) ----
:env
set "%~2="
for /f "usebackq tokens=1,* delims==" %%a in (`findstr /b /c:"%~1=" .env`) do (
  for /f "tokens=1 delims=#" %%v in ("%%b") do set "%~2=%%v"
)
REM trim trailing spaces
if defined %~2 for /f "tokens=* delims= " %%t in ("!%~2!") do set "%~2=%%t"
goto :eof

:fail
echo.
echo === Startup failed. See the messages above. ===
pause
exit /b 1
