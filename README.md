# YouTube Enhancer

YouTube Enhancer is a browser extension for controlling initial video quality and volume, opening Shorts as regular videos, autoplaying the next video, and disabling automatic dubbing. The current version is 0.1.0.

## Installation

- Chrome: Open `chrome://extensions`, enable **Developer mode**, select **Load unpacked**, and choose this folder.
- Firefox: Open `about:debugging#/runtime/this-firefox`, select **Load Temporary Add-on**, and choose `manifest.json`.

### Local installation in Brave

A locally signed CRX is not listed in the Chrome Web Store. Brave may show a warning for it even with **Developer mode** enabled. For local use, run `pnpm build`, open `brave://extensions`, select **Load unpacked**, and choose the `dist/source` directory. Do not select the ZIP or CRX file.

If you already installed the CRX, record your settings before removing it. Removing the CRX may delete settings saved in `chrome.storage.local`, and the unpacked version may have a different extension ID. Remove the CRX, load `dist/source`, and restore your settings. After rebuilding, click **Reload** on the extension card. To distribute a CRX without the store warning, publish the extension in the Chrome Web Store.

Click the **YouTube Enhancer** toolbar icon to open the settings tab. Saved settings also apply to open YouTube players.

Enable **스크린샷 버튼 활성화하기** to add a camera button immediately left of YouTube's autoplay control. Clicking it saves a JPG of the current frame at the playing video's pixel dimensions to the browser's Downloads folder. Protected or cross-origin video may block frame capture.

## Development checks

```sh
pnpm install
pnpm test
pnpm lint
pnpm format:check
```

In Chrome, check regular videos, playlists, embedded players, fullscreen playback, Shorts, and keyboard shortcuts. Playback in Firefox must be checked in an environment with Firefox installed.

## Build and distribution files

```sh
pnpm build
pnpm package
```

Copy `.env.example` to `.env` in the project root and set `CRX_SIGNING_KEY` to the path of a Chrome PEM file to create a CRX with `package`. Relative paths are resolved from the project root. Leave the key unset to skip CRX creation. If Chrome or Brave is not found automatically, use `pnpm run package --chrome-path <browser executable path>`.

`build` creates an unpacked extension in `dist/source`. `package` creates a distribution ZIP, an unsigned Firefox XPI, a source ZIP, and optionally a CRX. The XPI cannot be installed for normal Firefox distribution without Mozilla signing. The packaging script shared by both projects copies executable files from the root and regular asset directories, then minifies JavaScript, CSS, and HTML. To use it in another project, copy `scripts/package.mjs` and the `build` and `package` commands from `package.json`, then add `esbuild`, `fflate`, and `html-minifier-terser` as development dependencies.

Use `pnpm run update` to check dependencies, or `pnpm run upgrade` to update `package.json` and the lockfile.
