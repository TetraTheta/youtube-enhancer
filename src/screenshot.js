(() => {
  let enabled = false;
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'ytp-button';
  button.title = '스크린샷 저장';
  button.setAttribute('aria-label', '스크린샷 저장');
  button.style.cssText =
    'display: inline-flex; align-items: center; justify-content: center; padding: 0; background: transparent; border: 0; color: #fff;';
  button.innerHTML =
    '<svg viewBox="0 0 36 36" width="24" height="24" aria-hidden="true"><path fill="currentColor" d="M13 9h10l2 3h5v16H6V12h5l2-3zm5 6a5 5 0 1 0 0 10 5 5 0 0 0 0-10zm0 2a3 3 0 1 1 0 6 3 3 0 0 1 0-6z"/></svg>';

  function checkButton() {
    const player = document.querySelector('#movie_player');
    const controls = player?.querySelector('.ytp-right-controls');
    const autonav = controls?.querySelector('.ytp-autonav-toggle, .ytp-autonav-toggle-button-container');
    const anchor = autonav?.closest('.ytp-button') ?? autonav;
    const video = player?.querySelector('video.html5-main-video');
    if (!enabled || !anchor || !video || player.classList.contains('ad-showing')) {
      button.remove();
      return;
    }
    if (button.nextElementSibling !== anchor) {
      anchor.before(button);
    }
  }

  function saveScreenshot() {
    const video = document.querySelector('#movie_player video.html5-main-video');
    if (!video || video.readyState < 2 || !video.videoWidth || !video.videoHeight) {
      window.alert('캡처할 영상 프레임이 아직 준비되지 않았습니다.');
      return;
    }

    try {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext('2d').drawImage(video, 0, 0);
      chrome.runtime.sendMessage({ type: 'youtube-enhancer-screenshot', url: canvas.toDataURL('image/jpeg', 0.92) }, (response) => {
        const error = chrome.runtime.lastError?.message ?? response?.error;
        if (error) {
          window.alert(`스크린샷을 저장하지 못했습니다: ${error}`);
        }
      });
    } catch (error) {
      window.alert(`스크린샷을 캡처하지 못했습니다: ${error.message}`);
    }
  }

  button.addEventListener('click', saveScreenshot);
  document.addEventListener('youtube-enhancer-settings', (event) => {
    try {
      enabled = JSON.parse(event.detail).enableScreenshot === true;
      checkButton();
    } catch {
      // Ignore malformed settings messages from the page.
    }
  });
  document.dispatchEvent(new Event('youtube-enhancer-ready'));
  setInterval(checkButton, 500);
})();
