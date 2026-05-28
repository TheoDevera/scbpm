import os, io, hashlib, re, tempfile, subprocess, logging, time, secrets
from pathlib import Path
from flask import Flask, request, jsonify, send_file, redirect, send_from_directory, Response, make_response
from flask_cors import CORS
import yt_dlp
import soundfile as sf
import numpy as np
import aubio

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("scpitch")

FRONTEND_DIR = "/app/frontend"
CACHE_DIR = Path("/app/cache")
CACHE_DIR.mkdir(exist_ok=True)

app = Flask(__name__, static_folder=FRONTEND_DIR, static_url_path="")
CORS(app)

# ── accès par token URL ───────────────────────────────────────────────────────
ACCESS_TOKEN = os.environ.get("SCBPM_TOKEN", "")
COOKIE_NAME  = "scbpm_access"

def is_allowed():
    """Vérifie le cookie de session ou le token ?k= dans l'URL."""
    if not ACCESS_TOKEN:
        return True  # pas de token configuré → accès libre
    return request.cookies.get(COOKIE_NAME) == ACCESS_TOKEN

def grant_access_response(dest="/"):
    """Pose le cookie et redirige."""
    resp = make_response(redirect(dest))
    resp.set_cookie(COOKIE_NAME, ACCESS_TOKEN,
                    max_age=60*60*24*365, httponly=True, samesite="Lax")
    return resp

@app.before_request
def check_access():
    # /share pose lui-même le cookie si besoin
    if request.path == "/share":
        return
    # API : vérifier le cookie (les appels viennent du frontend déjà autorisé)
    if request.path.startswith("/api/"):
        if not is_allowed():
            return jsonify({"error": "non autorisé"}), 403
        return
    # Token dans l'URL → poser le cookie et rediriger
    if request.args.get("k") == ACCESS_TOKEN and ACCESS_TOKEN:
        dest = request.path or "/"
        return grant_access_response(dest)
    # Pas de token configuré ou cookie valide → OK
    if is_allowed():
        return
    # Accès refusé : page blanche avec message
    return make_response("Accès réservé.", 403)

# ── helpers ──────────────────────────────────────────────────────────────────

def get_stream_url(url: str) -> dict:
    ydl_opts = {
        "format": "bestaudio/best",
        "quiet": True,
        "no_warnings": True,
        "extract_flat": False,
    }
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(url, download=False)
    return {
        "stream_url": info.get("url"),
        "title": info.get("title", ""),
        "duration": info.get("duration", 0),
        "thumbnail": info.get("thumbnail", ""),
    }

def analyze_bpm(audio_path: str) -> float:
    win_s = 512
    hop_s = 256
    samplerate = 44100
    src = aubio.source(audio_path, samplerate, hop_s)
    samplerate = src.samplerate
    tempo = aubio.tempo("default", win_s, hop_s, samplerate)
    beats = []
    while True:
        samples, read = src()
        is_beat = tempo(samples)
        if is_beat:
            beats.append(tempo.get_last_s())
        if read < hop_s:
            break
    if len(beats) < 4:
        return 0.0
    intervals = np.diff(beats)
    bpm = 60.0 / np.median(intervals)
    return round(float(bpm), 1)

def download_to_wav(url: str, dest: str):
    """Télécharge via yt-dlp et convertit en WAV 44100Hz mono via ffmpeg."""
    ydl_opts = {
        "format": "bestaudio/best",
        "quiet": True,
        "outtmpl": dest + ".%(ext)s",
        "postprocessors": [{
            "key": "FFmpegExtractAudio",
            "preferredcodec": "wav",
        }],
    }
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        ydl.download([url])
    # yt-dlp ajoute .wav automatiquement
    wav_path = dest + ".wav"
    if not Path(wav_path).exists():
        raise FileNotFoundError(f"WAV introuvable après download : {wav_path}")
    return wav_path


def cache_key(url: str, variant) -> str:
    return hashlib.md5(f"{url}|{variant}".encode()).hexdigest()

# ── routes ───────────────────────────────────────────────────────────────────

@app.route("/api/health")
def health():
    return jsonify({"ok": True})

@app.route("/api/resolve")
def resolve():
    url = request.args.get("url", "").strip()
    if not url:
        return jsonify({"error": "url manquante"}), 400
    try:
        info = get_stream_url(url)
        return jsonify(info)
    except Exception as e:
        log.error(f"resolve error: {e}")
        return jsonify({"error": str(e)}), 500

@app.route("/api/bpm")
def bpm_endpoint():
    url = request.args.get("url", "").strip()
    if not url:
        return jsonify({"error": "url manquante"}), 400
    key = cache_key(url, 0)
    wav_path = CACHE_DIR / f"{key}_orig.wav"
    try:
        download_to_wav(url, str(CACHE_DIR / f"{key}_orig"))
        bpm = analyze_bpm(str(wav_path))
        return jsonify({"bpm": bpm})
    except Exception as e:
        log.error(f"bpm error: {e}")
        return jsonify({"error": str(e)}), 500
    finally:
        try:
            wav_path.unlink(missing_ok=True)
        except Exception:
            pass

@app.route("/api/render")
def render():
    url = request.args.get("url", "").strip()
    if not url:
        return jsonify({"error": "url manquante"}), 400
    try:
        info = get_stream_url(url)
        return redirect(info["stream_url"])
    except Exception as e:
        log.error(f"render error: {e}")
        return jsonify({"error": str(e)}), 500

SC_URL_RE = re.compile(r'https?://(?:www\.)?soundcloud\.com/\S+')

@app.route("/share", methods=["GET", "POST"])
def share_target():
    raw = (request.args.get("url") or request.args.get("text") or
           request.form.get("url") or request.form.get("text") or "").strip()
    # SoundCloud partage parfois l'URL noyée dans un texte ("Écoute X sur SC : https://...")
    m = SC_URL_RE.search(raw)
    url = m.group(0).rstrip('.,)') if m else raw
    if url:
        return redirect(f"/?url={url}")
    return redirect("/")

@app.route("/", defaults={"path": ""})
@app.route("/<path:path>")
def serve_frontend(path):
    if path and (Path(FRONTEND_DIR) / path).exists():
        return send_from_directory(FRONTEND_DIR, path)
    return send_from_directory(FRONTEND_DIR, "index.html")

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 10000))
    app.run(host="0.0.0.0", port=port, debug=False)
