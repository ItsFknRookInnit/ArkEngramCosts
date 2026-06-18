# Ark Engram Cost Editor

A terminal-styled web tool for editing ARK: Survival Ascended engram crafting
costs and exporting a `Game.ini` override block
(`ConfigOverrideItemCraftingCosts`).

Engram and resource data is pulled live from a public Google Sheet (gviz
JSON endpoint) at load time.

## Local development

```bash
npm install
npm run dev
```

This starts a local dev server (default `http://localhost:5173`).

## Build

```bash
npm run build
npm run preview   # optional: preview the production build locally
```

The production build is output to `dist/`.

## Deploying to Vercel

1. Push this repo to GitHub.
2. In Vercel, click **Add New Project** and import the GitHub repo.
3. Vercel auto-detects the Vite framework preset:
   - **Build command:** `npm run build`
   - **Output directory:** `dist`
4. Click **Deploy**.

No environment variables are required — the Google Sheet IDs are hardcoded
in `src/App.jsx`.

## Configuration

The sheet/tab IDs the app reads from live near the top of `src/App.jsx`:

```js
const ITEMS_SHEET_ID = '1Gt9_KXXupzUEcuB-aS6oIUut6wEDB-Kol_4z_7ghO_U';
const ITEMS_GID = '894821371';
const RES_GID = '1400851834';
```

Update these if you point the tool at a different sheet. The sheet must be
shared as "Anyone with the link can view" for the gviz endpoint to work
client-side.

## Usage

- **Search** filters engrams by name or class string.
- Click an engram row to expand it and edit individual resource amounts.
- **Import** reads an existing `Game.ini` (or any text file containing
  `ConfigOverrideItemCraftingCosts=` lines) and loads those overrides into
  the editor.
- **Show Modified** filters the list down to engrams you've changed.
- **Reset** clears all overrides.
- The right-hand panel shows the live `Game.ini` block — click **Copy** to
  copy it to your clipboard and paste it into your server's `Game.ini`.
