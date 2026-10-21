import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import { transform } from 'esbuild';
import { zipSync } from 'fflate';
import { minify } from 'html-minifier-terser';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, 'dist');
const source = path.join(output, 'source');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
const packageInfo = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const { values } = parseArgs({
  options: {
    'chrome-path': { type: 'string' },
    'source-only': { type: 'boolean' },
  },
});

assert.equal(manifest.version, packageInfo.version, 'manifest.json과 package.json의 버전이 다릅니다.');
const filename = `${packageInfo.name}-${manifest.version}`;
const envFile = path.join(root, '.env');
if (fs.existsSync(envFile)) {
  process.loadEnvFile(envFile);
}

function* files(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || /\.(?:pem|key|p12|pfx)$/i.test(entry.name)) {
      continue;
    }
    const filename = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      yield* files(filename);
    } else if (entry.isFile()) {
      yield filename;
    }
  }
}

function archive(destination, inputs, base) {
  const contents = {};
  for (const filename of inputs) {
    contents[path.relative(base, filename).split(path.sep).join('/')] = fs.readFileSync(filename);
  }
  fs.writeFileSync(destination, zipSync(contents, { level: 9 }));
}

function chromePath() {
  if (values['chrome-path']) {
    const browser = path.resolve(root, values['chrome-path']);
    assert.ok(fs.existsSync(browser), `Chrome/Brave를 찾지 못했습니다: ${browser}`);
    return browser;
  }

  const candidates = [
    path.join(process.env.LOCALAPPDATA ?? '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
    path.join(process.env.PROGRAMFILES ?? '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
    path.join(process.env['PROGRAMFILES(X86)'] ?? '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
    path.join(process.env.PROGRAMFILES ?? '', 'BraveSoftware', 'Brave-Browser', 'Application', 'brave.exe'),
  ];
  const found = candidates.find((candidate) => fs.existsSync(candidate));
  assert.ok(found, 'Chrome/Brave를 찾지 못했습니다. --chrome-path를 지정하세요.');
  return found;
}

const keyValue = process.env.CRX_SIGNING_KEY?.trim();
const key = keyValue ? path.resolve(root, keyValue) : null;
if (key && !values['source-only']) {
  assert.ok(fs.existsSync(key) && fs.statSync(key).isFile(), `CRX 서명 키가 없습니다: ${key}`);
}

const excluded = new Set(['.git', 'dist', 'node_modules', 'scripts', 'tests']);
const runtimeFiles = [path.join(root, 'manifest.json')];
for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
  if (entry.isDirectory() && !entry.name.startsWith('.') && !excluded.has(entry.name)) {
    runtimeFiles.push(...files(path.join(root, entry.name)));
  } else if (entry.isFile() && /\.(?:js|css|html|svg|png|jpg|jpeg|webp|gif|wasm)$/.test(entry.name)) {
    runtimeFiles.push(path.join(root, entry.name));
  }
}

assert.equal(path.relative(root, source), path.join('dist', 'source'));
fs.rmSync(source, { recursive: true, force: true });
for (const input of runtimeFiles) {
  const relative = path.relative(root, input);
  const destination = path.join(source, relative);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  const extension = path.extname(input);
  if (extension === '.js' || extension === '.css') {
    const result = await transform(fs.readFileSync(input, 'utf8'), {
      loader: extension.slice(1),
      minify: true,
      target: 'es2022',
      legalComments: 'none',
    });
    fs.writeFileSync(destination, result.code);
  } else if (extension === '.html') {
    fs.writeFileSync(
      destination,
      await minify(fs.readFileSync(input, 'utf8'), {
        collapseWhitespace: true,
        keepClosingSlash: true,
        minifyCSS: true,
        minifyJS: true,
        removeComments: true,
      }),
    );
  } else {
    fs.copyFileSync(input, destination);
  }
}
console.log(`압축해제 확장 프로그램: ${source}`);

if (!values['source-only']) {
  const zip = path.join(output, `${filename}.zip`);
  archive(zip, files(source), source);
  fs.copyFileSync(zip, path.join(output, `${filename}-firefox-unsigned.xpi`));

  const sourceFiles = [...runtimeFiles];
  for (const name of ['scripts', 'tests']) {
    if (fs.existsSync(path.join(root, name))) {
      sourceFiles.push(...files(path.join(root, name)));
    }
  }
  for (const name of [
    '.env.example',
    '.editorconfig',
    '.gitignore',
    '.prettierignore',
    '.prettierrc.json',
    'eslint.config.mjs',
    'prettier.config.mjs',
    'README.md',
    'package.json',
    'package-lock.json',
    'pnpm-lock.yaml',
    'pnpm-workspace.yaml',
  ]) {
    const filename = path.join(root, name);
    if (fs.existsSync(filename)) {
      sourceFiles.push(filename);
    }
  }
  archive(path.join(output, `${filename}-source.zip`), sourceFiles, root);

  const crx = path.join(output, `${filename}.crx`);
  fs.rmSync(crx, { force: true });
  fs.rmSync(`${source}.crx`, { force: true });
  if (key) {
    execFileSync(chromePath(), ['--no-message-box', `--pack-extension=${source}`, `--pack-extension-key=${key}`], { stdio: 'inherit' });
    assert.ok(fs.existsSync(`${source}.crx`), 'Chrome CRX 생성에 실패했습니다.');
    fs.renameSync(`${source}.crx`, crx);
    console.warn('Brave may warn that this CRX is not listed in the Chrome Web Store. For local use, load dist/source as an unpacked extension.');
  }
  console.log(`배포 파일: ${output}`);
}
