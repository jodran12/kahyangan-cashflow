@echo off
chcp 65001 >nul
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js belum terpasang. Unduh versi LTS di https://nodejs.org lalu jalankan file ini lagi.
  pause
  exit /b
)
if not exist node_modules (
  echo Memasang paket untuk pertama kali, mohon tunggu...
  call npm install
)
set ADMIN_USER=admin
set ADMIN_PASS=admin123
echo.
echo Slip Gaji berjalan di http://localhost:3100  (login: admin / admin123)
echo Tutup jendela ini untuk menghentikan server.
start "" /min cmd /c "timeout /t 3 /nobreak >nul & start http://localhost:3100"
node server.js
pause
