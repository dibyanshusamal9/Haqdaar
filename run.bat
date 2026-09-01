@echo off
REM ============================================================
REM  Livelihood Setu — one-shot dev launcher (Windows)
REM  Brings up: Postgres (Docker) + voice API + web dashboard,
REM  then opens the mic demo page.
REM ============================================================
setlocal ENABLEDELAYEDEXPANSION
cd /d "%~dp0"

echo.
echo === [1/5] Checking prerequisites ===
where docker    >nul 2>&1 || (echo   ! docker not found in PATH & goto :fail)
where python    >nul 2>&1 || (echo   ! python not found in PATH & goto :fail)
where pnpm      >nul 2>&1 || (echo   ! pnpm not found in PATH   & goto :fail)
echo   OK  docker, python, pnpm

echo.
echo === [2/5] Starting Postgres (docker compose) ===
docker compose up -d
if errorlevel 1 goto :fail

echo   Waiting for Postgres to accept connections...
set /a tries=0
:waitdb
docker exec project-db-1 pg_isready -U postgres -d setu >nul 2>&1
if not errorlevel 1 goto dbready
set /a tries+=1
if !tries! GEQ 30 (echo   ! Postgres did not become ready in 30s & goto :fail)
timeout /t 1 /nobreak >nul
goto waitdb
:dbready
echo   OK  Postgres ready on localhost:5432

REM Apply the expansion seed if the marker QP is missing (idempotent)
docker exec project-db-1 psql -U postgres -d setu -tAc "select 1 from qualifications where qp_code='AMH/Q1001'" 2>nul | findstr /r "^1$" >nul
if errorlevel 1 (
  echo   Seeding NSQF expansion corpus...
  docker exec -i project-db-1 psql -U postgres -d setu < db\seed\seed_nsqf_expansion.sql >nul 2>&1
  echo   OK  seeded
) else (
  echo   OK  NSQF corpus already present, skipping seed
)

echo.
echo === [3/5] Installing Python deps for voice service (idempotent) ===
python -m pip install -q -r apps\voice\requirements.txt
if errorlevel 1 goto :fail
echo   OK  python deps installed

if not exist apps\web\node_modules (
  echo.
  echo === [3b/5] Installing web deps (first run only) ===
  pushd apps\web
  call pnpm install
  popd
)

echo.
echo === [4/5] Freeing ports 8000 (voice) and 3000 (web) if in use ===
for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":8000 " ^| findstr LISTENING') do taskkill /PID %%p /F >nul 2>&1
for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":3000 " ^| findstr LISTENING') do taskkill /PID %%p /F >nul 2>&1

echo.
echo === [5/5] Launching voice API and web dashboard ===
start "Setu Voice API"  cmd /k "cd /d %~dp0apps\voice && python -m uvicorn app.main:app --port 8000 --host 127.0.0.1"
start "Setu Web"        cmd /k "cd /d %~dp0apps\web   && pnpm dev"

echo.
echo   Waiting for services to come up...
set /a tries=0
:waitapi
powershell -NoProfile -Command "try { (Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:8000/health' -TimeoutSec 1).StatusCode } catch { 0 }" | findstr "200" >nul
if not errorlevel 1 goto apiready
set /a tries+=1
if !tries! GEQ 30 (echo   ! Voice API did not respond in 30s & goto :openbrowser)
timeout /t 1 /nobreak >nul
goto waitapi
:apiready
echo   OK  Voice API responding

:openbrowser
echo.
echo ============================================================
echo   Ready.
echo     Mic demo    :  http://127.0.0.1:8000/ui/mic.html
echo     API docs    :  http://127.0.0.1:8000/docs
echo     Dashboard   :  http://localhost:3000
echo ============================================================
rundll32 url.dll,FileProtocolHandler http://127.0.0.1:8000/ui/mic.html
timeout /t 1 /nobreak >nul
rundll32 url.dll,FileProtocolHandler http://localhost:3000
echo.
echo   Two console windows have opened (voice + web). Close them
echo   to stop the services. Postgres keeps running in Docker;
echo   run "docker compose down" to stop it.
echo.
goto :eof

:fail
echo.
echo === Startup failed. See messages above. ===
pause
exit /b 1
