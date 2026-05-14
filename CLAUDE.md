# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Install dependencies
npm install

# Build for production (outputs to dist/)
npm run build

# Dev server (not useful for extensions — load unpacked instead)
npm run dev
```

**Loading the extension in Chrome:**
1. Run `npm run build`
2. Go to `chrome://extensions/`
3. Enable Developer mode
4. Click "Load unpacked" and select the `dist/` folder

> The `manifest.json` now lives in `src/` and is copied to `dist/` at build time — always load `dist/`, never the raw `extension/` folder.

## Architecture

This is a **Chrome Extension (Manifest V3)** that communicates with network scanners using the **eSCL/AirScan protocol** over HTTP.

### Message-passing flow

All scanner operations go through the Service Worker:

```
popup.js  ──sendMessage──►  background.js  ──imports──►  core/escl.js
                                           ──imports──►  core/discovery.js
```

`popup.js` never calls scanner APIs directly — it sends typed messages (`START_SCAN`, `DISCOVER_SCANNERS`, `CONNECTIVITY_TEST`, `DEBUG_XML`, `GET_LAST_SCAN`, `COPY_LAST_SCAN`) to `background.js` via `chrome.runtime.sendMessage`. The background service worker is the only context that makes HTTP requests to scanners.

### Core modules

- **`src/core/escl.js`** — eSCL protocol implementation: builds scan job XML (PWG namespace, version 2.63 required for HP), creates jobs via POST to `/eSCL/ScanJobs`, polls job status, fetches completed images. Contains retry logic for 403/409 errors.
- **`src/core/discovery.js`** — Network scanner discovery: scans candidate IPs in parallel batches (20 at a time) by probing `/eSCL/ScannerStatus`. Prioritizes common printer IP ranges (e.g. `192.168.68.106`).
- **`src/background.js`** — Service Worker, handles all message dispatching, holds `lastScan` in memory.

### Pages

- **`src/popup/`** — Main UI (350px popup). Saves/loads settings via `chrome.storage.local`. On open, auto-discovers scanners if no IP is configured, then runs a connectivity test.
- **`src/preview/`** — Full-tab preview page. Reads scan data from `chrome.storage.local` (`currentScan`, `scanHistory`). Opened when user clicks the scan preview image.
- **`src/options/`** — Extension options page (`chrome.runtime.openOptionsPage()`).

### Data persistence

Scan images are stored as data URLs in `chrome.storage.local`:
- `currentScan` / `lastScanData` — most recent scan
- `scanHistory` — last 10 scans (trimmed in `popup.js`)

The background worker also keeps `lastScan` in memory for the current session.

### Build

Vite bundles the extension (`vite.config.ts`). Entry points cover background, popup, options, and preview HTML. The Vite plugin copies `src/manifest.json` and `icons/` into `dist/` after bundling. The `dist/` folder is gitignored.

New files added in this step:
- `tsconfig.json` — TypeScript config targeting ES2020, Preact JSX
- `src/core/types.ts` — shared types (ColorMode, ScanFormat, DPI, ScanSettings, etc.)
- `src/manifest.json` — manifest source (replaces root-level manifest.json)
- All page HTML files renamed from `*.html` → `index.html`

### eSCL protocol notes

- HP scanners require `<pwg:Version>2.63</pwg:Version>` in the scan settings XML.
- Scanner capabilities (`/eSCL/ScannerCapabilities`) are fetched before each scan to adjust resolution, color mode, and page dimensions to what the scanner actually supports.
- Color mode values in eSCL XML: `RGB24`, `Grayscale8`, `BlackAndWhite1` — these differ from the UI labels (`Color`, `Grayscale`).
- A warm-up call (`getCapabilities`) is made before creating a scan job to avoid 403 errors on idle scanners.
