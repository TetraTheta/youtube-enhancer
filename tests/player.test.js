const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');

function loadLogic() {
  const context = vm.createContext({ URL });
  vm.runInContext(fs.readFileSync(path.join(root, 'src/player-logic.js'), 'utf8'), context);
  return context.YouTubeEnhancerLogic;
}

function createPlayerHarness() {
  const listeners = new Map();
  const calls = { quality: [], volume: [], autoplay: 0, audio: [], reload: [] };
  const video = {
    readyState: 1,
    addEventListener() {},
    removeEventListener() {},
  };
  const toggle = {
    checked: 'true',
    getAttribute() {
      return this.checked;
    },
    click() {
      calls.autoplay += 1;
      this.checked = this.checked === 'true' ? 'false' : 'true';
    },
  };
  const player = {
    videoId: 'abcdefghijk',
    levels: ['hd720', 'medium'],
    currentAudio: null,
    tracks: [],
    classList: { contains: () => false },
    querySelector(selector) {
      if (selector === 'video.html5-main-video') return video;
      if (selector === '.ytp-autonav-toggle-button[aria-checked]') return toggle;
      return null;
    },
    getVideoData() {
      return { video_id: this.videoId };
    },
    getAvailableQualityLevels() {
      return this.levels;
    },
    setPlaybackQualityRange(value) {
      calls.quality.push(value);
    },
    setPlaybackQuality() {},
    setVolume(value) {
      calls.volume.push(value);
    },
    getAvailableAudioTracks() {
      return this.tracks;
    },
    getAudioTrack() {
      return this.currentAudio;
    },
    setAudioTrack(track) {
      calls.audio.push(track);
      this.currentAudio = track;
    },
    focus() {
      document.activeElement = player;
    },
  };
  const document = {
    activeElement: null,
    fullscreenElement: null,
    addEventListener(type, handler) {
      listeners.set(type, handler);
    },
    dispatchEvent(event) {
      listeners.get(event.type)?.(event);
    },
    querySelector(selector) {
      return selector === '#movie_player' ? player : null;
    },
    hasFocus() {
      return false;
    },
  };
  const location = {
    href: 'https://www.youtube.com/watch?v=abcdefghijk',
    pathname: '/watch',
    search: '?v=abcdefghijk',
    replace(url) {
      calls.reload.push(url);
    },
  };
  const context = vm.createContext({
    document,
    location,
    console,
    setInterval() {},
    URL,
    URLSearchParams,
    Event: class Event {
      constructor(type) {
        this.type = type;
      }
    },
  });
  for (const file of ['player-logic.js', 'player.js']) {
    vm.runInContext(fs.readFileSync(path.join(root, 'src', file), 'utf8'), context);
  }

  const defaults = {
    qualityVideo: 'hd720',
    qualityPlaylist: 'hd720',
    qualityEmbed: 'medium',
    qualityVideoFullscreen: 'hd1080',
    qualityPlaylistFullscreen: 'hd1080',
    qualityEmbedFullscreen: 'hd1080',
    setInitialVolume: true,
    volume: 50,
    convertShorts: true,
    autoplay: false,
    disableAutoDubbing: true,
  };
  function update(patch = {}) {
    document.dispatchEvent({
      type: 'youtube-enhancer-settings',
      detail: JSON.stringify({ ...defaults, ...patch }),
    });
  }

  return { calls, document, location, player, update };
}

test('uses the nearest available quality below the target', () => {
  const logic = loadLogic();
  assert.equal(logic.chooseQuality('hd1080', ['hd1440', 'hd720', 'medium']), 'hd720');
  assert.equal(logic.chooseQuality('small', ['medium', 'hd720']), 'medium');
  assert.equal(logic.chooseQuality('auto', []), 'auto');
});

test('selects separate video, playlist, and embed fullscreen profiles', () => {
  const logic = loadLogic();
  assert.equal(logic.qualitySettingKey('https://www.youtube.com/watch?v=abcdefghijk', false), 'qualityVideo');
  assert.equal(logic.qualitySettingKey('https://www.youtube.com/watch?v=abcdefghijk&list=PL1', true), 'qualityPlaylistFullscreen');
  assert.equal(logic.qualitySettingKey('https://www.youtube-nocookie.com/embed/abcdefghijk', false), 'qualityEmbed');
});

test('converts only YouTube Shorts URLs and preserves query parameters', () => {
  const logic = loadLogic();
  assert.equal(logic.watchUrlForShort('https://www.youtube.com/shorts/abcdefghijk?t=42'), 'https://www.youtube.com/watch?t=42&v=abcdefghijk');
  assert.equal(logic.watchUrlForShort('https://example.com/shorts/abcdefghijk'), null);
  assert.equal(logic.watchUrlForShort('https://www.youtube.com/shorts/invalid'), null);
});

test('chooses an original track over an automatic dub', () => {
  const logic = loadLogic();
  const dubbed = { id: 'en.auto', isAutoDubbed: true };
  const original = { id: 'ja', isOriginal: true };
  assert.equal(logic.originalAudioTrack([dubbed, original], dubbed), original);
  assert.equal(logic.originalAudioTrack([dubbed, original], original), null);
});

test('applies volume once per video and keeps manual changes across other settings', () => {
  const harness = createPlayerHarness();
  harness.update();
  harness.document.dispatchEvent({ type: 'yt-navigate-finish' });
  harness.update({ autoplay: true });
  assert.deepEqual(harness.calls.volume, [50]);
  assert.equal(harness.calls.autoplay, 2);
  assert.deepEqual(harness.calls.reload, []);

  harness.player.videoId = 'lmnopqrstuv';
  harness.location.href = 'https://www.youtube.com/watch?v=lmnopqrstuv';
  harness.location.search = '?v=lmnopqrstuv';
  harness.document.dispatchEvent({ type: 'yt-navigate-finish' });
  assert.deepEqual(harness.calls.volume, [50, 50]);
});
