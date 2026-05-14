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

Easy Scan requires the **eSCL/AirScan protocol** — a wireless scanning standard built into most printers released after 2017.

- HP: OfficeJet, DeskJet, ENVY, LaserJet, Smart Tank series
- Epson: EcoTank, WorkForce, Expression, SureColor series
- Canon: PIXMA, imageCLASS, MAXIFY series

> **AirPrint ≠ AirScan.** AirPrint (printing) and AirScan (scanning) are separate features. A printer that supports AirPrint may not support AirScan. Always check for explicit "AirScan" or "eSCL" support in your printer's specifications.
>
> **Quick compatibility check:** open `http://<printer-ip>/eSCL/ScannerStatus` in your browser. An XML response means your printer is compatible. An error means it's not.

## Installation (development)

```bash
npm install
npm run build
```

1. Open `chrome://extensions/`
2. Enable **Developer mode**
3. Click **Load unpacked** and select the `dist/` folder

> Always load `dist/`, not the raw `extension/` folder — the project uses Vite and requires a build step.

## Architecture

```
popup.js  ──sendMessage──►  background.js  ──►  core/escl.js
                                            ──►  core/discovery.js
```

`popup.js` never calls scanner APIs directly. All HTTP requests to scanners go through the background service worker (`background.js`).

| Module | Role |
|---|---|
| `src/core/escl.ts` | eSCL protocol (TypeScript): typed API, `ScannerError` class, retry logic, XML builder |
| `src/core/escl.js` | eSCL protocol (legacy JS) — used by `background.js` until migration to `background.ts` |
| `src/core/discovery.ts` | Scans candidate IPs in parallel batches to find scanners on the network |
| `src/core/types.ts` | Shared types: `ScanSettings`, `ScannerCapabilities`, `ScanJob`, `ScanResult`, etc. |
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
