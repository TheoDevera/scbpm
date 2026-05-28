chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'open-in-scbpm',
    title: 'Ouvrir dans SC BPM',
    contexts: ['link', 'page'],
    documentUrlPatterns: ['*://soundcloud.com/*', '*://www.soundcloud.com/*'],
  });
});

chrome.contextMenus.onClicked.addListener(async (info) => {
  if (info.menuItemId !== 'open-in-scbpm') return;
  const trackUrl = info.linkUrl || info.pageUrl;
  const { appUrl = 'http://localhost:47823' } = await chrome.storage.sync.get('appUrl');
  chrome.tabs.create({ url: `${appUrl}/?url=${encodeURIComponent(trackUrl)}` });
});
