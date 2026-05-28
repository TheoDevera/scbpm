'use strict';

chrome.storage.sync.get({ appUrl: 'http://localhost:47823' }, ({ appUrl }) => {
  document.getElementById('app-url').value = appUrl;
});

document.getElementById('save-btn').addEventListener('click', () => {
  const url = document.getElementById('app-url').value.trim().replace(/\/$/, '');
  chrome.storage.sync.set({ appUrl: url }, () => {
    const msg = document.getElementById('saved-msg');
    msg.style.display = 'block';
    setTimeout(() => { msg.style.display = 'none'; }, 2000);
  });
});
