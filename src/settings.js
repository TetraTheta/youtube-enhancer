(() => {
  const defaults = globalThis.YouTubeEnhancerDefaults;
  let settings = { ...defaults };

  function publishSettings() {
    document.dispatchEvent(
      new CustomEvent('youtube-enhancer-settings', {
        detail: JSON.stringify(settings),
      }),
    );
  }

  document.addEventListener('youtube-enhancer-ready', publishSettings);

  chrome.storage.local.get(defaults, (stored) => {
    settings = { ...defaults, ...stored };
    publishSettings();
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') {
      return;
    }

    for (const [key, change] of Object.entries(changes)) {
      if (Object.hasOwn(defaults, key)) {
        settings[key] = change.newValue ?? defaults[key];
      }
    }
    publishSettings();
  });
})();
