@echo off
chcp 65001 >nul
setlocal

set "PROJECT_DIR=%~dp0"
cd /d "%PROJECT_DIR%"

echo KÖL platform is starting...
echo Open: http://localhost:3000
echo Design System: http://localhost:3000/design-system
echo.

start "" "%PROJECT_DIR%"

if not exist "node_modules" (
  echo node_modules not found. Running npm install...
  call npm install
  if errorlevel 1 (
    echo.
    echo npm install failed. Copy the error text from this window.
    pause
    exit /b 1
  )
)

start "" powershell -NoProfile -WindowStyle Hidden -Command "Start-Sleep -Seconds 5; Start-Process 'http://localhost:3000'; Start-Process 'http://localhost:3000/design-system'"

call npm run dev

pause
