# Ark Engram Cost Editor

**Live app:** https://arkengramcosts.vercel.app/

A specialized, high-performance tool designed to manage and override Ark: Survival Evolved or Ark: Survival Ascended crafting costs. This web application pulls live data from a centralized Google Sheet, parses blueprint paths into valid game class strings, and generates the necessary INI configuration overrides for your game server.

## Overview

The Ark Engram Cost Editor provides a professional, terminal-styled interface to help server administrators fine-tune their game economy. It features real-time search, recipe reconstruction, and a delta output generator to ensure that only your modifications are exported.

## Usage

1. **Synchronization** — On opening the application, the system automatically fetches the latest item and resource data from the configured Google Master Sheet.
2. **Configuration**
   - Use the **Search System** to quickly locate the item you wish to modify.
   - Click on an item to expand its current resource requirements.
   - Input your custom values into the resource fields. The application automatically calculates the delta requirements.
3. **Deployment** — Once your modifications are complete, click the **Copy** button in the Ini Output panel. Paste these lines directly into your server's `GameUserSettings.ini` or `Game.ini` file, under the `[/Script/ShooterGame.ShooterGameMode]` section.

## Change Log

### v1.0.0 — Initial Release
- Implemented live Google Sheet data parsing engine.
- Introduced Blueprint-to-Class-String transformation logic for ARK native paths.
- Added dynamic delta output generation for server configuration files.
- Integrated terminal-inspired UI with a responsive grid layout.

### v1.1.0 — Deployment Fix
- Restored the `src/` directory (`main.jsx`, `App.jsx`, `index.css`), which was dropped during a GitHub web upload and caused Vercel builds to fail with a Rollup "failed to resolve import" error.
- Removed a stray uploaded build artifact from the repo root.
- Verified a clean `npm run build` prior to redeploying.

## Technical Details

Built with **Vite + React + Tailwind CSS**. There's no backend — all data fetching (the Google Sheets gviz endpoint) and INI generation happen client-side in the browser.
