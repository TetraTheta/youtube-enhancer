(() => {
  const qualityOrder = ['tiny', 'small', 'medium', 'large', 'hd720', 'hd1080', 'hd1440', 'hd2160', 'hd2880', 'highres'];

  function chooseQuality(requested, available) {
    if (requested === 'auto') {
      return 'auto';
    }

    const target = qualityOrder.indexOf(requested);
    if (target < 0 || !Array.isArray(available)) {
      return null;
    }

    const levels = available.filter((level) => qualityOrder.includes(level));
    if (levels.length === 0) {
      return null;
    }

    return (
      levels.reduce((best, level) => {
        const index = qualityOrder.indexOf(level);
        if (index <= target && (best === null || index > qualityOrder.indexOf(best))) {
          return level;
        }
        return best;
      }, null) ?? levels.reduce((lowest, level) => (qualityOrder.indexOf(level) < qualityOrder.indexOf(lowest) ? level : lowest))
    );
  }

  function qualitySettingKey(url, fullscreen) {
    const address = new URL(url);
    const isEmbed = /^\/embed\//.test(address.pathname);
    const isPlaylist = !isEmbed && address.searchParams.has('list');
    const base = isEmbed ? 'qualityEmbed' : isPlaylist ? 'qualityPlaylist' : 'qualityVideo';
    return fullscreen ? `${base}Fullscreen` : base;
  }

  function watchUrlForShort(url) {
    const address = new URL(url);
    if (address.origin !== 'https://www.youtube.com') {
      return null;
    }
    const match = /^\/shorts\/([\w-]{11})\/?$/.exec(address.pathname);
    if (!match) {
      return null;
    }

    address.pathname = '/watch';
    address.searchParams.set('v', match[1]);
    return address.href;
  }

  function trackInfo(track) {
    try {
      return track?.getLanguageInfo?.() ?? {};
    } catch {
      return {};
    }
  }

  function isAutoDubbed(track) {
    const info = trackInfo(track);
    const flags = ['isAutoDubbed', 'isAutoDubbing', 'autoDubbed', 'isAutomaticallyDubbed'];
    if ([track, info].some((source) => flags.some((flag) => source?.[flag] === true))) {
      return true;
    }

    const label = [track?.id, track?.name, track?.languageName, info.id, info.name].filter(Boolean).join(' ');
    return /auto[\s_-]*dub|automatic[\s_-]*dub|자동\s*더빙/i.test(label);
  }

  function isOriginal(track) {
    const info = trackInfo(track);
    if (track?.isOriginal === true || info.isOriginal === true) {
      return true;
    }

    const label = [track?.name, track?.languageName, info.name].filter(Boolean).join(' ');
    return /original|원본|원어/i.test(label);
  }

  function sameTrack(left, right) {
    if (left === right) {
      return true;
    }

    const leftId = trackInfo(left).id ?? left?.id;
    const rightId = trackInfo(right).id ?? right?.id;
    return Boolean(leftId && rightId && leftId === rightId);
  }

  function originalAudioTrack(tracks, current) {
    if (!Array.isArray(tracks) || tracks.length < 2) {
      return null;
    }

    const permitted = tracks.filter((track) => !isAutoDubbed(track));
    const original = permitted.find(isOriginal);
    const target =
      original ?? (isAutoDubbed(current) ? (permitted.find((track) => track?.isDefault || trackInfo(track).isDefault) ?? permitted[0]) : null);
    return target && !sameTrack(target, current) ? target : null;
  }

  globalThis.YouTubeEnhancerLogic = Object.freeze({
    chooseQuality,
    qualitySettingKey,
    watchUrlForShort,
    originalAudioTrack,
  });
})();
