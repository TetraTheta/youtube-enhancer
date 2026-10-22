const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');

test('shows the camera only when enabled and captures at the video dimensions', () => {
  const listeners = new Map();
  const calls = { dimensions: [], messages: [], alerts: [] };
  const button = {
    parentElement: null,
    nextElementSibling: null,
    style: {},
    addEventListener(type, handler) {
      this[type] = handler;
    },
    setAttribute() {},
    remove() {
      this.parentElement = null;
      this.nextElementSibling = null;
    },
  };
  const controls = {
    querySelector() {
      return autonav;
    },
  };
  const autonav = {
    closest() {
      return this;
    },
    before(element) {
      element.parentElement = controls;
      element.nextElementSibling = this;
    },
  };
  const video = { readyState: 2, videoWidth: 3840, videoHeight: 2160 };
  const player = {
    classList: { contains: () => false },
    querySelector(selector) {
      return selector === '.ytp-right-controls' ? controls : selector === 'video.html5-main-video' ? video : null;
    },
  };
  const document = {
    createElement(tag) {
      if (tag === 'button') return button;
      return {
        getContext() {
          return { drawImage: (source, x, y) => calls.dimensions.push([this.width, this.height, source, x, y]) };
        },
        toDataURL() {
          return 'data:image/jpeg;base64,AAAA';
        },
      };
    },
    querySelector(selector) {
      return selector === '#movie_player' || selector === '#movie_player video.html5-main-video'
        ? selector === '#movie_player'
          ? player
          : video
        : null;
    },
    addEventListener(type, handler) {
      listeners.set(type, handler);
    },
    dispatchEvent(event) {
      listeners.get(event.type)?.(event);
    },
  };
  const chrome = {
    runtime: {
      sendMessage(message, callback) {
        calls.messages.push(message);
        callback({});
      },
    },
  };
  const context = vm.createContext({ document, chrome, window: { alert: (message) => calls.alerts.push(message) }, setInterval() {}, Event });
  vm.runInContext(fs.readFileSync(path.join(root, 'src/screenshot.js'), 'utf8'), context);

  assert.equal(button.parentElement, null);
  document.dispatchEvent({ type: 'youtube-enhancer-settings', detail: '{"enableScreenshot":true}' });
  assert.equal(button.parentElement, controls);
  assert.equal(button.nextElementSibling, autonav);
  assert.match(button.style.cssText, /align-items: center/);
  assert.match(button.innerHTML, /width="24" height="24"/);
  button.click();
  assert.deepEqual(calls.dimensions, [[3840, 2160, video, 0, 0]]);
  assert.equal(calls.messages[0].url, 'data:image/jpeg;base64,AAAA');
  assert.deepEqual(calls.alerts, []);

  document.dispatchEvent({ type: 'youtube-enhancer-settings', detail: '{"enableScreenshot":false}' });
  assert.equal(button.parentElement, null);
});

test('downloads only screenshot messages from YouTube', () => {
  let listener;
  const downloads = [];
  const chrome = {
    action: { onClicked: { addListener() {} } },
    runtime: {
      onMessage: {
        addListener(handler) {
          listener = handler;
        },
      },
    },
    downloads: {
      download(options, callback) {
        downloads.push(options);
        callback();
      },
    },
  };
  vm.runInNewContext(fs.readFileSync(path.join(root, 'src/background.js'), 'utf8'), { chrome });

  const responses = [];
  const message = { type: 'youtube-enhancer-screenshot', url: 'data:image/jpeg;base64,AAAA' };
  assert.equal(
    listener(message, { url: 'https://www.youtube.com/watch?v=abcdefghijk' }, (response) => responses.push(response)),
    true,
  );
  assert.equal(downloads.length, 1);
  assert.match(downloads[0].filename, /^youtube-screenshot-.*\.jpg$/);
  assert.equal(downloads[0].saveAs, false);
  assert.equal(responses[0].error, undefined);
  listener(message, { url: 'https://example.com/' }, () => {});
  listener({ ...message, url: 'https://example.com/' }, { url: 'https://www.youtube.com/' }, (response) => responses.push(response));
  assert.equal(downloads.length, 1);
  assert.match(responses[1].error, /올바르지 않습니다/);
});
