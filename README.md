# Nilai Parser Web

Aplikasi Flask untuk input data seperti `21.25.24.26x5.` lalu menampilkan rekap angka `00-99`, total, sisa aktif, dan fitur potong.

## Fitur
- Input format custom `21.25.24.26x5.`
- Penyimpanan permanen ke SQLite
- Grid angka `00-99`
- Rekapan total masuk, total potong, total sisa
- Fitur potong angka
- Riwayat input dan riwayat potong
- Siap dijalankan di Visual Studio Code

## Cara menjalankan (Lokal)

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python wsgi.py
```

Buka browser ke:

```bash
http://127.0.0.1:5000
```

## Cara menjalankan dengan Docker (VPS)

Cukup jalankan perintah berikut di folder proyek:

```bash
docker compose up -d --build
```

Aplikasi dan Nginx akan otomatis berjalan:
- Akses lewat domain/IP (Port 80): `http://aidenwebafiq.site` atau `http://IP_VPS`
- Akses langsung port aplikasi (Port 5000): `http://IP_VPS:5000`
- Database SQLite tersimpan aman di folder `./instance/app.db`

Perintah pengelolaan container:
```bash
# Lihat log aplikasi
docker compose logs -f

# Restart aplikasi
docker compose restart

# Hentikan aplikasi
docker compose down
```

## Format input
- `21.25.24.26x5.`
- `01.02.03x10`
- `99x1.`

Arti:
- semua angka sebelum `x` akan mendapat nilai yang sama sesuai angka setelah `x`

## Catatan
- angka valid hanya `00` sampai `99`
- potong tidak boleh melebihi sisa aktif
