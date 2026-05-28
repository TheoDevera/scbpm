#!/bin/sh
set -e
echo "[entrypoint] MAJ yt-dlp..."
pip install --no-cache-dir -U yt-dlp || echo "[entrypoint] MAJ échouée, on continue"
echo "[entrypoint] Démarrage gunicorn sur port ${SCPITCH_PORT}..."
exec gunicorn -w 2 -k gthread --threads 4 -t 180 \
  -b 0.0.0.0:${PORT:-10000} \
  --chdir /app/backend app:app
