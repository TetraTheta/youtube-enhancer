chrome.action.onClicked.addListener(() => {
  chrome.runtime.openOptionsPage();
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== 'youtube-enhancer-screenshot' || !/^https:\/\/www\.youtube(?:-nocookie)?\.com\//.test(sender.url ?? '')) {
    return;
  }
  if (typeof message.url !== 'string' || !message.url.startsWith('data:image/jpeg;base64,')) {
    sendResponse({ error: '스크린샷 데이터가 올바르지 않습니다.' });
    return;
  }

  const filename = `youtube-screenshot-${new Date().toISOString().replace(/[:.]/g, '-')}.jpg`;
  chrome.downloads.download({ url: message.url, filename, saveAs: false, conflictAction: 'uniquify' }, () => {
    sendResponse({ error: chrome.runtime.lastError?.message });
  });
  return true;
});
