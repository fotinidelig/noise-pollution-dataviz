# Noise pollution dataviz

Interactive website exploring **Europe environmental noise** (EEA END exposure + WHO / EU thresholds — threshold choice TBD), with nature dB as a reference layer and Asia city data for comparison later. Sound interactivity planned; children BoD deferred for now.

Audience: general public + portfolio. Sprint deliverable: a Vite + React + D3 site on an OpenStreetMap-based map (MapLibre).

## Repository structure

```
noise-pollution-dataviz/
├── analysis/          # Python scripts + marimo notebooks (later)
├── data/
│   ├── raw/           # Empty for now — do not download END/Asia yet
│   └── processed/     # Derived tables / geo for the app
├── app/               # Vite + React + TypeScript interactive viz
└── README.md
```

## How to run the app

```bash
cd app
npm install
npm run dev
```

Then open the URL Vite prints (usually `http://localhost:5173`).

Other scripts (from `app/`):

- `npm run build` — production build
- `npm run preview` — preview the production build
- `npm run lint` — lint

## Stack notes

- **Analysis:** Python scripts + marimo (to be added under `analysis/`)
- **Front end:** Vite, React, TypeScript, D3, MapLibre GL (OSM-friendly). MapLibre is installed; the UI currently shows a stub only — no tiles / Map instance yet.
- **Hosting:** later (GitHub Pages or Netlify)

## Project store resources

Curated source lists live in the Project Agent Store (not duplicated here):

- Europe / EEA END + health: `/cursor/stores/self/docs/europe-noise-active-resources.md`  
  (also `/cursor/stores/bc-36eb9549-bf41-46b2-908b-412b53810f5d/docs/europe-noise-active-resources.md`)
- Asia city noise: `/cursor/stores/self/docs/asia-city-noise-resources.md`  
  (also `/cursor/stores/bc-36eb9549-bf41-46b2-908b-412b53810f5d/docs/asia-city-noise-resources.md`)

## Data policy (sprint start)

`data/raw/` and `data/processed/` are empty placeholders (`.gitkeep` only). **Do not download END, Asia, or other large datasets until explicitly approved.**
