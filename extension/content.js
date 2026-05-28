const BTN_ID = 'scbpm-inject-btn';

function isTrackPage() {
  const parts = location.pathname.split('/').filter(Boolean);
  return parts.length >= 2;
}

async function getAppUrl() {
  return new Promise(resolve => {
    chrome.storage.sync.get({ appUrl: 'http://localhost:47823' }, d => resolve(d.appUrl));
  });
}

async function injectButton() {
  if (!isTrackPage()) { removeButton(); return; }
  if (document.getElementById(BTN_ID)) { updateButtonHref(); return; }

  const appUrl = await getAppUrl();
  const btn = document.createElement('a');
  btn.id       = BTN_ID;
  btn.target   = '_blank';
  btn.rel      = 'noopener';
  btn.title    = 'Ouvrir dans SC BPM';
  btn.textContent = '⬡ BPM';
  btn.href     = `${appUrl}/?url=${encodeURIComponent(location.href)}`;

  Object.assign(btn.style, {
    position:       'fixed',
    bottom:         '76px',
    right:          '18px',
    zIndex:         '99999',
    background:     '#ff5500',
    color:          '#fff',
    fontFamily:     'system-ui, sans-serif',
    fontWeight:     '700',
    fontSize:       '13px',
    padding:        '8px 14px',
    borderRadius:   '20px',
    textDecoration: 'none',
    boxShadow:      '0 2px 8px rgba(0,0,0,.4)',
    transition:     'opacity .15s',
  });
  btn.onmouseenter = () => btn.style.opacity = '.8';
  btn.onmouseleave = () => btn.style.opacity = '1';

  document.body.appendChild(btn);
}

function updateButtonHref() {
  const btn = document.getElementById(BTN_ID);
  if (!btn) return;
  getAppUrl().then(appUrl => {
    btn.href = `${appUrl}/?url=${encodeURIComponent(location.href)}`;
  });
}

function removeButton() {
  document.getElementById(BTN_ID)?.remove();
}

// SoundCloud est une SPA : écoute les changements d'URL
let lastUrl = location.href;
new MutationObserver(() => {
  if (location.href === lastUrl) return;
  lastUrl = location.href;
  injectButton();
}).observe(document.documentElement, { childList: true, subtree: true });

injectButton();
