const assert = require('node:assert/strict');
const { Buffer } = require('node:buffer');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const { unzipSync } = require('fflate');

const root = path.resolve(__dirname, '..');
const release = path.join(root, 'dist', 'youtube-enhancer-0.1.0.zip');
const xpi = path.join(root, 'dist', 'youtube-enhancer-0.1.0-firefox-unsigned.xpi');
const source = path.join(root, 'dist', 'youtube-enhancer-0.1.0-source.zip');

test('packages a minified extension and readable source', () => {
  const build = spawnSync(process.execPath, [path.join(root, 'scripts', 'package.mjs')], {
    cwd: root,
    encoding: 'utf8',
  });
  assert.equal(build.status, 0, build.stderr);

  const files = unzipSync(fs.readFileSync(release));
  const sourceFiles = unzipSync(fs.readFileSync(source));
  assert.ok(files['manifest.json']);
  assert.ok(files['src/background.js']);
  assert.equal(files['background.js'], undefined);
  assert.deepEqual(JSON.parse(Buffer.from(files['manifest.json']).toString('utf8')).background, {
    service_worker: 'src/background.js',
    scripts: ['src/background.js'],
  });
  assert.ok(files['src/player-logic.js']);
  assert.equal(files['tests/player.test.js'], undefined);
  assert.ok(sourceFiles['scripts/package.mjs']);
  assert.ok(sourceFiles['.env.example']);
  assert.equal(sourceFiles['.env'], undefined);
  assert.ok(sourceFiles['pnpm-lock.yaml']);
  assert.deepEqual(fs.readFileSync(xpi), fs.readFileSync(release));

  const context = vm.createContext({ URL });
  vm.runInContext(Buffer.from(files['src/player-logic.js']).toString('utf8'), context);
  assert.equal(context.YouTubeEnhancerLogic.chooseQuality('hd1080', ['medium', 'hd720']), 'hd720');
});

test('rejects a missing CRX signing key', () => {
  const build = spawnSync(process.execPath, [path.join(root, 'scripts', 'package.mjs')], {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, CRX_SIGNING_KEY: 'missing.pem' },
  });
  assert.notEqual(build.status, 0);
  assert.match(build.stderr, /CRX 서명 키가 없습니다/);
});
