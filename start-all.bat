@echo off
title PedalPass + ESP32 Smart Bike Lock Launcher
cd /d "%~dp0"

echo ==============================================================
echo  Starting PedalPass Software Suite + ESP32 Hardware Bridge...
echo ==============================================================

start "1. ESP32 Wi-Fi Bridge (Port 3001)" cmd /k "node esp32-bridge.mjs"
start "2. PedalPass Admin Web Portal - React (http://localhost:3000)" cmd /k "cd web && npm run dev"
start "3. PedalPass Admin Web Portal - Angular (http://localhost:4200)" cmd /k "cd web-angular && npx ng serve --host 0.0.0.0 --port 4200"
start "4. PedalPass Student Mobile App - Expo (http://localhost:8081)" cmd /k "cd mobile && npx expo start --lan"

echo.
echo All 4 servers have been launched in separate terminal windows:
echo   - Student Mobile App (Browser / Expo Go): http://localhost:8081
echo   - Admin Web Portal (React):               http://localhost:3000
echo   - Admin Web Portal (Angular 22):          http://localhost:4200
echo   - ESP32 Hardware Wi-Fi Bridge:            http://localhost:3001
echo.
pause
