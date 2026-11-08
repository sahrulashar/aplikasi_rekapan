#!/bin/bash
set -e

echo "=========================================="
echo " Setup Otomatis VPS - Aplikasi Rekapan"
echo " Domain: aidenwebafiq.site"
echo "=========================================="

# 1. Install Docker jika belum ada
if ! command -v docker &> /dev/null; then
    echo "[1/3] Menginstal Docker di VPS baru..."
    apt-get update -y
    apt-get install -y ca-certificates curl gnupg
    curl -fsSL https://get.docker.com | sh
    systemctl enable docker
    systemctl start docker
else
    echo "[1/3] Docker sudah terpasang."
fi

# 2. Matikan web server bawaan OS jika ada yang memakai port 80
if systemctl is-active --quiet apache2 2>/dev/null; then
    echo "Menghentikan apache2 bawaan agar port 80 tidak bentrok..."
    systemctl stop apache2
    systemctl disable apache2
fi

if systemctl is-active --quiet nginx 2>/dev/null; then
    echo "Menghentikan nginx bawaan OS agar port 80 dipakai oleh Docker Nginx..."
    systemctl stop nginx
    systemctl disable nginx
fi

# 3. Jalankan Docker Compose
echo "[2/3] Membangun dan menjalankan aplikasi + Nginx..."
docker compose up -d --build

echo "[3/3] Selesai!"
echo "=========================================="
echo " Aplikasi sudah jalan!"
echo " - Domain : http://aidenwebafiq.site"
echo " - IP VPS : http://$(curl -s ifconfig.me || echo 'IP_VPS_ANDA')"
echo "=========================================="
