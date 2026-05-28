'use strict';

const audio        = document.getElementById('audio');
const urlInput     = document.getElementById('url-input');
const bpmSlider    = document.getElementById('bpm-slider');
const bpmOffsetVal = document.getElementById('bpm-offset-val');
const bpmDisplay   = document.getElementById('bpm-display');
const bpmArrow     = document.getElementById('bpm-arrow');
const bpmTarget    = document.getElementById('bpm-target');
const statusEl     = document.getElementById('status');
const playerEl     = document.getElementById('player');
const thumbEl      = document.getElementById('thumb');
const titleEl      = document.getElementById('track-title');
const audioLoading = document.getElementById('audio-loading');

let currentUrl  = '';
let originalBpm = 0;
let applyTimer  = null;

// Pitch preservation : le navigateur ajuste le tempo sans changer la tonalité
// (Chrome 86+, Firefox 99+, Safari)
audio.preservesPitch = true;
if ('mozPreservesPitch' in audio) audio.mozPreservesPitch = true;

// ── URL form ──────────────────────────────────────────────────────────────────

document.getElementById('url-form').addEventListener('submit', e => {
  e.preventDefault();
  const url = urlInput.value.trim();
  if (url) loadTrack(url);
});

// ── Load track ────────────────────────────────────────────────────────────────

async function loadTrack(url) {
  currentUrl  = url;
  originalBpm = 0;

  audio.playbackRate = 1.0;
  bpmSlider.value    = 0;
  bpmSlider.disabled = true;
  bpmTarget.disabled = true;
  bpmTarget.value    = '';
  bpmArrow.classList.add('hidden');
  bpmOffsetVal.textContent = '0';
  bpmDisplay.innerHTML = '<span class="spinner-sm"></span>';

  playerEl.classList.add('hidden');
  setStatus('Résolution de l\'URL…');

  try {
    const res = await fetch('/api/resolve?url=' + encodeURIComponent(url));
    const data = await res.json();
    if (data.error) throw new Error(data.error);

    thumbEl.src = data.thumbnail || '';
    titleEl.textContent = data.title || '';
    setStatus('');
    playerEl.classList.remove('hidden');

    audioLoading.classList.remove('hidden');
    audio.src = '/api/render?url=' + encodeURIComponent(url);
    audio.load();
    audio.addEventListener('canplay', () => {
      audioLoading.classList.add('hidden');
    }, { once: true });
    audio.addEventListener('error', () => {
      audioLoading.classList.add('hidden');
      setStatus('Erreur de lecture audio', true);
    }, { once: true });

    fetchBpm(url);
  } catch (err) {
    setStatus(err.message || 'Erreur de chargement', true);
  }
}

// ── Tempo (playbackRate côté navigateur, instantané) ──────────────────────────

function applyTempo(offset) {
  if (originalBpm <= 0) return;
  audio.playbackRate = (originalBpm + offset) / originalBpm;
}

// ── Slider ────────────────────────────────────────────────────────────────────

bpmSlider.addEventListener('input', e => {
  const offset = parseInt(e.target.value, 10);
  syncControls(offset, 'slider');
  clearTimeout(applyTimer);
  applyTimer = setTimeout(() => applyTempo(offset), 80);
});

// ── Champ BPM direct ──────────────────────────────────────────────────────────

bpmTarget.addEventListener('input', () => {
  const target = parseFloat(bpmTarget.value);
  if (!isFinite(target) || target <= 0) return;
  const offset = Math.round(target - originalBpm);
  bpmSlider.value = Math.max(-20, Math.min(20, offset));
  bpmOffsetVal.textContent = (offset >= 0 ? '+' : '') + offset;
  bpmArrow.classList.toggle('hidden', offset === 0);
  clearTimeout(applyTimer);
  applyTimer = setTimeout(() => applyTempo(offset), 80);
});

bpmTarget.addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    clearTimeout(applyTimer);
    const target = parseFloat(bpmTarget.value);
    if (isFinite(target) && target > 0) {
      applyTempo(Math.round(target - originalBpm));
    }
  }
});

// ── Sync slider ↔ champ ───────────────────────────────────────────────────────

function syncControls(offset, source) {
  if (source !== 'slider') bpmSlider.value = Math.max(-20, Math.min(20, offset));
  bpmOffsetVal.textContent = (offset >= 0 ? '+' : '') + offset;
  if (source !== 'input' && originalBpm > 0) bpmTarget.value = Math.round(originalBpm + offset);
  bpmArrow.classList.toggle('hidden', offset === 0);
}

// ── BPM detection ─────────────────────────────────────────────────────────────

async function fetchBpm(url) {
  try {
    const res = await fetch('/api/bpm?url=' + encodeURIComponent(url));
    const data = await res.json();
    if (data.bpm && data.bpm > 0) {
      originalBpm = data.bpm;
      bpmDisplay.textContent = originalBpm.toFixed(1);
      bpmTarget.min   = Math.round(originalBpm - 20);
      bpmTarget.max   = Math.round(originalBpm + 20);
      bpmTarget.value = Math.round(originalBpm);
      bpmSlider.disabled = false;
      bpmTarget.disabled = false;
      // Réappliquer le tempo si le slider avait déjà été bougé
      const offset = parseInt(bpmSlider.value, 10);
      if (offset !== 0) applyTempo(offset);
    } else {
      bpmDisplay.textContent = '—';
    }
  } catch {
    bpmDisplay.textContent = '—';
  }
}

// ── Status ────────────────────────────────────────────────────────────────────

function setStatus(msg, isError = false) {
  if (!msg) { statusEl.classList.add('hidden'); return; }
  statusEl.textContent = msg;
  statusEl.classList.remove('hidden', 'error');
  if (isError) statusEl.classList.add('error');
}

// ── Share target ──────────────────────────────────────────────────────────────

const sharedUrl = new URLSearchParams(location.search).get('url');
if (sharedUrl) {
  urlInput.value = sharedUrl;
  loadTrack(sharedUrl);
}

// ── Service worker ────────────────────────────────────────────────────────────

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(() => {});
}
