(() => {
  const logic = globalThis.YouTubeEnhancerLogic;
  delete globalThis.YouTubeEnhancerLogic;

  const qualityValues = new Set(['auto', 'tiny', 'small', 'medium', 'large', 'hd720', 'hd1080', 'hd1440', 'hd2160', 'hd2880', 'highres']);
  const qualityKeys = [
    'qualityVideo',
    'qualityPlaylist',
    'qualityEmbed',
    'qualityVideoFullscreen',
    'qualityPlaylistFullscreen',
    'qualityEmbedFullscreen',
  ];
  let settings;
  let currentPlayer;
  let currentVideo;
  let currentVideoId;
  let appliedQuality;
  let appliedVolume;
  let focusedVideo;

  function acceptSettings(event) {
    try {
      const incoming = JSON.parse(event.detail);
      if (!incoming || typeof incoming !== 'object') {
        return;
      }

      const next = { ...settings };
      for (const key of qualityKeys) {
        if (qualityValues.has(incoming[key])) {
          next[key] = incoming[key];
        }
      }
      if (Number.isInteger(incoming.volume) && incoming.volume >= 0 && incoming.volume <= 100) {
        next.volume = incoming.volume;
      }
      for (const key of ['setInitialVolume', 'convertShorts', 'autoplay', 'disableAutoDubbing']) {
        if (typeof incoming[key] === 'boolean') {
          next[key] = incoming[key];
        }
      }

      const qualityChanged = qualityKeys.some((key) => next[key] !== settings?.[key]);
      const volumeChanged = next.volume !== settings?.volume || next.setInitialVolume !== settings?.setInitialVolume;
      settings = next;
      if (qualityChanged) {
        appliedQuality = undefined;
      }
      if (volumeChanged) {
        appliedVolume = undefined;
      }
      checkPlayer();
    } catch {
      // Ignore malformed settings messages from the page.
    }
  }

  function videoIdFromAddress() {
    if (location.pathname === '/watch') {
      return new URLSearchParams(location.search).get('v');
    }
    return /^\/embed\/([\w-]{11})/.exec(location.pathname)?.[1] ?? null;
  }

  function applyQuality(player, videoId) {
    const fullscreen = Boolean(document.fullscreenElement || player.classList.contains('ytp-fullscreen'));
    const key = logic.qualitySettingKey(location.href, fullscreen);
    const requested = settings[key];
    if (!requested || appliedQuality === `${videoId}:${key}:${requested}`) {
      return;
    }
    if (typeof player.getAvailableQualityLevels !== 'function') {
      return;
    }

    const selected = logic.chooseQuality(requested, player.getAvailableQualityLevels());
    if (!selected) {
      return;
    }
    if (typeof player.setPlaybackQualityRange === 'function') {
      player.setPlaybackQualityRange(selected, selected);
    }
    if (typeof player.setPlaybackQuality === 'function') {
      player.setPlaybackQuality(selected);
    }
    appliedQuality = `${videoId}:${key}:${requested}`;
  }

  function applyVolume(player, video, videoId) {
    if (!settings.setInitialVolume || video.readyState < 1 || appliedVolume === `${videoId}:${settings.volume}`) {
      return;
    }

    if (typeof player.setVolume === 'function') {
      player.setVolume(settings.volume);
    } else {
      video.volume = settings.volume / 100;
    }
    appliedVolume = `${videoId}:${settings.volume}`;
  }

  function applyAutoplay(player) {
    const toggle = player.querySelector('.ytp-autonav-toggle-button[aria-checked]');
    if (toggle && (toggle.getAttribute('aria-checked') === 'true') !== settings.autoplay) {
      toggle.click();
    }
  }

  function applyAudioTrack(player) {
    if (!settings.disableAutoDubbing || typeof player.getAvailableAudioTracks !== 'function' || typeof player.setAudioTrack !== 'function') {
      return;
    }

    const target = logic.originalAudioTrack(player.getAvailableAudioTracks(), player.getAudioTrack?.());
    if (target) {
      player.setAudioTrack(target);
    }
  }

  function focusPlayer(player, videoId) {
    if (focusedVideo === videoId || !document.hasFocus()) {
      return;
    }

    const active = document.activeElement;
    if (active?.closest?.('input, textarea, select, [contenteditable], [role="textbox"]')) {
      return;
    }

    player.focus({ preventScroll: true });
    if (document.activeElement === player) {
      focusedVideo = videoId;
    }
  }

  function checkPlayer() {
    if (!settings) {
      return;
    }

    if (settings.convertShorts) {
      const watchUrl = logic.watchUrlForShort(location.href);
      if (watchUrl) {
        location.replace(watchUrl);
        return;
      }
    }

    const addressId = videoIdFromAddress();
    if (!addressId) {
      return;
    }

    const player = document.querySelector('#movie_player');
    const video = player?.querySelector('video.html5-main-video');
    if (!player || !video) {
      return;
    }

    if (player.classList.contains('ad-showing')) {
      return;
    }

    const playerId = player.getVideoData?.()?.video_id;
    if (playerId && playerId !== addressId) {
      return;
    }

    if (currentPlayer !== player || currentVideo !== video || currentVideoId !== addressId) {
      currentVideo?.removeEventListener('loadedmetadata', checkPlayer);
      currentVideo?.removeEventListener('playing', checkPlayer);
      currentPlayer = player;
      currentVideo = video;
      currentVideoId = addressId;
      appliedQuality = undefined;
      appliedVolume = undefined;
      focusedVideo = undefined;
      video.addEventListener('loadedmetadata', checkPlayer);
      video.addEventListener('playing', checkPlayer);
    }

    try {
      applyQuality(player, addressId);
      applyVolume(player, video, addressId);
      applyAutoplay(player);
      applyAudioTrack(player);
      focusPlayer(player, addressId);
    } catch (error) {
      console.warn('YouTube Enhancer: 플레이어 설정을 적용하지 못했습니다.', error);
    }
  }

  function rewriteShortsLink(event) {
    if (!settings?.convertShorts) {
      return;
    }

    const anchor = event.target.closest?.('a[href]');
    if (!anchor) {
      return;
    }
    const watchUrl = logic.watchUrlForShort(anchor.href);
    if (watchUrl) {
      // shortcut: YouTube may ignore the rewritten link and navigate to Shorts first; replace this when its internal navigation API stabilizes.
      anchor.href = watchUrl;
    }
  }

  document.addEventListener('youtube-enhancer-settings', acceptSettings);
  document.addEventListener('click', rewriteShortsLink, true);
  document.addEventListener('yt-navigate-finish', checkPlayer);
  document.addEventListener('yt-page-data-updated', checkPlayer);
  document.addEventListener('fullscreenchange', checkPlayer);
  document.addEventListener('visibilitychange', checkPlayer);
  setInterval(checkPlayer, 500);
  document.dispatchEvent(new Event('youtube-enhancer-ready'));
})();
