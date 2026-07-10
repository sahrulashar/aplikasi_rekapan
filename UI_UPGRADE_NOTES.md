# Catatan Pengembangan UI - Aplikasi Rekapan Pro

## Fokus pengembangan
- Tampilan dibuat lebih profesional, modern, dan premium.
- Halaman login dibuat ulang dengan layout dua panel, background visual, dan form yang lebih rapi.
- Dashboard dibuat seperti control center dengan hero section, live session clock, card omzet, input center, dan panduan cepat.
- Halaman rekapan diperkuat dengan statistik, action card, grid number board, panel copy angka aktif, dan rekapan per nama.
- Halaman riwayat dibuat lebih bersih untuk audit data input.
- Halaman detail per nama dibuat lebih premium dan mudah dibaca.

## File utama yang diubah
- `templates/base.html`
- `templates/index.html`
- `templates/login.html`
- `templates/person_page.html`
- `static/css/style.css`
- `app/routes.py`
- `app/services.py`

## Tambahan kecil pada fungsi
- Endpoint edit manual rekap sesi `/api/session-manual` ditambahkan karena tombol edit/simpan/hapus sesi sudah tersedia di tampilan.
- Override manual sesi akan tampil di halaman detail per nama tanpa menghapus data input asli.

## Cara menjalankan
```bash
python -m venv .venv
source .venv/bin/activate  # Linux/Mac
# Windows: .venv\Scripts\activate
pip install -r requirements.txt
python app.py
```

Buka:
```bash
http://127.0.0.1:5000
```
