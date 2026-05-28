'use strict';

(async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const { appUrl = 'http://localhost:47823' } = await chrome.storage.sync.get('appUrl');
  const content = document.getElementById('content');
  const url = tab?.url || '';

  if (url.includes('soundcloud.com/')) {
    content.innerHTML = `
      <div class="track-url">${url}</div>
      <button id="open-btn">Ouvrir dans SC BPM</button>
      <a class="settings" id="opts-link">Paramètres (URL de l'app)</a>
    `;
    document.getElementById('open-btn').addEventListener('click', () => {
      chrome.tabs.create({ url: `${appUrl}/?url=${encodeURIComponent(url)}` });
      window.close();
    });
    document.getElementById('opts-link').addEventListener('click', () => {
      chrome.runtime.openOptionsPage();
    });
  } else {
    content.innerHTML = `
      <p class="hint">Navigue vers un track SoundCloud pour l'ouvrir directement dans SC BPM.</p>
      <a class="settings" id="opts-link">Paramètres (URL de l'app)</a>
    `;
    document.getElementById('opts-link').addEventListener('click', () => {
      chrome.runtime.openOptionsPage();
    });
  }
})();
