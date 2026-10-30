#!/bin/bash
cd "$(dirname "$0")"
command -v node >/dev/null || { echo "Node.js belum terpasang. Unduh versi LTS di https://nodejs.org lalu jalankan file ini lagi."; read -p "Tekan Enter untuk menutup..."; exit 1; }
[ -d node_modules ] || { echo "Memasang paket untuk pertama kali, mohon tunggu..."; npm install; }
export ADMIN_USER=admin ADMIN_PASS=admin123
echo "Slip Gaji berjalan di http://localhost:3100  (login: admin / admin123)"
(sleep 2; open http://localhost:3100 2>/dev/null || xdg-open http://localhost:3100 2>/dev/null) &
node server.js
