# Easy Scan

Scan documents wirelessly from Chrome via eSCL/AirScan. No driver, no software. Works with HP, Epson, Canon & more.

---

## Features

- Automatic scanner discovery on your local Wi-Fi network
- Single-page scan with instant preview
- Download as JPEG or PDF
- Adjustable resolution (75–600 DPI depending on scanner)
- Color, Grayscale, and Black & White modes
- Scan history (last 10 scans)
- Works entirely offline — no account, no cloud, no data sent anywhere

## Compatible scanners

Any scanner or all-in-one printer that supports eSCL/AirScan:

- HP OfficeJet, DeskJet, ENVY, LaserJet series
- Epson EcoTank, WorkForce, Expression series
- Canon PIXMA, imageCLASS series
- Brother MFC series

## Installation (development)

1. Clone this repo
2. Open `chrome://extensions/`
3. Enable **Developer mode**
4. Click **Load unpacked** and select the `extension/` folder

No build step required for development. To load a production build:

```bash
npm install
npm run build
# then load the dist/ folder instead
```

## Architecture

```
popup.js  ──sendMessage──►  background.js  ──►  core/escl.js
                                            ──►  core/discovery.js
```

`popup.js` never calls scanner APIs directly. All HTTP requests to scanners go through the background service worker (`background.js`).

| Module | Role |
|---|---|
| `src/core/escl.js` | eSCL protocol: builds scan job XML, creates jobs, polls status, fetches images |
| `src/core/discovery.js` | Scans candidate IPs in parallel batches to find scanners on the network |
| `src/background.js` | Service Worker — handles all message dispatching |
| `src/popup/` | Main UI (350px popup) |
| `src/preview/` | Full-tab scan preview page |
| `src/options/` | Extension options page |

## Development

```bash
npm install       # install dependencies
npm run build     # production build → dist/
npm run dev       # Vite dev server (use Load unpacked in Chrome instead)
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for branch model, commit conventions, and PR guidelines.

## License

[MIT](LICENSE) — Copyright (c) 2026 noecmt
