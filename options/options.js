(() => {
  const defaults = globalThis.YouTubeEnhancerDefaults;
  const qualityChoices = [
    ['auto', 'YouTube 자동'],
    ['highres', '4320p'],
    ['hd2880', '2880p'],
    ['hd2160', '2160p'],
    ['hd1440', '1440p'],
    ['hd1080', '1080p'],
    ['hd720', '720p'],
    ['large', '480p'],
    ['medium', '360p'],
    ['small', '240p'],
    ['tiny', '144p'],
  ];
  const fields = [...document.querySelectorAll('[data-setting]')];
  const status = document.querySelector('#status');
  const volumeValue = document.querySelector('#volumeValue');

  for (const field of fields) {
    if (field.tagName === 'SELECT') {
      for (const [value, label] of qualityChoices) {
        field.add(new Option(label, value));
      }
    }
  }

  function showSettings(settings) {
    for (const field of fields) {
      const value = settings[field.dataset.setting];
      if (field.type === 'checkbox') {
        field.checked = value;
      } else {
        field.value = value;
      }
    }
    volumeValue.value = `${settings.volume}%`;
    document.querySelector('#volume').disabled = !settings.setInitialVolume;
  }

  chrome.storage.local.get(defaults, showSettings);

  for (const field of fields) {
    field.addEventListener('change', () => {
      const value = field.type === 'checkbox' ? field.checked : field.type === 'range' ? Number(field.value) : field.value;

      if (field.id === 'setInitialVolume') {
        document.querySelector('#volume').disabled = !value;
      }
      if (field.id === 'volume') {
        volumeValue.value = `${value}%`;
      }

      chrome.storage.local.set({ [field.dataset.setting]: value }, () => {
        status.textContent = chrome.runtime.lastError ? '설정을 저장하지 못했습니다.' : '저장되었습니다.';
      });
    });
  }
})();
