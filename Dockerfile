FROM python:3.11-slim

# Mencegah Python membuat file .pyc dan memastikan log langsung tampil
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    TZ=Asia/Makassar

WORKDIR /app

# Install dependencies terlebih dahulu agar ter-cache oleh Docker
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Salin seluruh kode proyek ke dalam container
COPY . .

# Pastikan folder instance tersedia untuk database SQLite
RUN mkdir -p /app/instance

EXPOSE 5000

# Jalankan aplikasi menggunakan Gunicorn (production server)
CMD ["gunicorn", "--bind", "0.0.0.0:5000", "--workers", "1", "--threads", "8", "--timeout", "120", "wsgi:app"]
