# TradePilot

A local personal trading workstation, starting with stock watchlists and paper trading. Uses installed agent CLIs through provider adapters; Angel One is the first planned market-data provider, followed by 5paisa. Futures, options and live execution are later milestones.

## Foundation available now

- React dashboard with Pipeline, Watchlists, Orders & Positions, Journal, Notifications and Configuration.
- SQLite-backed manual stock entry and CSV imports. QuanTfy symbol columns are supported, with conflict validation and duplicate suppression.
- Persistent manual/auto entry preference, pause preference, paper capital, risk and notification settings.
- Persistent notification inbox and read status; atomic import/settings audit records.
- Installed executable detection for Codex, Claude and Cursor. Sign-in is explicitly unchecked.
- Loopback-only HTTP backend, write-session token, origin checks and bounded request bodies.

Broker sign-in/data, AI invocation, strategy discovery, paper fills/positions, Windows notifications and backups are **not implemented yet**. There is no live execution capability. Saved settings do not activate trading. Actual trades and P&L are not simulated in this milestone.

## Run locally

Requires Node.js 24 LTS and npm. Node's built-in SQLite is used; this runtime may print a SQLite experimental-feature notice.

```sh
npm ci
npm run dev
```

Open http://127.0.0.1:5173. The development backend listens on http://127.0.0.1:4317. Both processes stop with Ctrl+C.

For the compiled application:

```sh
npm run build
npm start
```

Open http://127.0.0.1:4317. State is stored in `.tradepilot/workspace.sqlite`, relative to the launch directory. `TRADEPILOT_DATA_DIR` can select another workspace. Keep the folder and database out of Git. Do not manually copy an active SQLite database as a backup; a consistent backup flow is a later milestone.

For a generic CSV use `symbol,name,exchange`. QuanTfy's `NSE code`, `Name`, and optional `NSE Code,` are recognized. Entire malformed imports are rejected; repeated stocks are skipped. Source filenames are recorded, but this release does not preserve fundamental score snapshots or preview column mappings.

## Development checks

```sh
npm run check
npm run build
```

See [architecture](docs/architecture.md), [milestones](docs/roadmap.md), and [coding rules](AGENTS.md). No broker credentials are needed for the foundation. Do not share broker secrets in issues, logs or chat.
