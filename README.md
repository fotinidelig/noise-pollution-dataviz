# Noise pollution dataviz

Interactive website exploring **Europe environmental noise** (EEA END exposure + WHO / EU thresholds — threshold choice TBD), with nature dB as a reference layer and Asia city data for comparison later. Sound interactivity planned; children BoD deferred for now.

Audience: general public + portfolio. Sprint deliverable: a Vite + React + D3 site on an OpenStreetMap-based map (MapLibre).

## Repository structure

```
noise-pollution-dataviz/
├── analysis/          # Python scripts + marimo notebooks
├── data/
│   ├── raw/eea-end/   # END exposure Excel + contour GPKGs (large; gitignored)
│   └── processed/     # Small CSV summaries for EDA / later viz
├── app/               # Vite + React + TypeScript interactive viz
└── README.md
```

## Analysis (EDA)

```bash
cd analysis
uv venv .venv --python 3.12
uv pip install --python .venv/bin/python -r requirements.txt
source .venv/bin/activate
python scripts/download_eea_end.py          # resume-friendly
python scripts/process_exposure.py
python scripts/process_contours.py          # area aggregates only
python scripts/preprocess_map_layers.py     # simplify → PMTiles for MapLibre
marimo edit notebooks/end_2022_exposure_contours_eda.py
```

Raw inventory / URLs: [`data/raw/eea-end/README.md`](data/raw/eea-end/README.md).

## How to run the app

```bash
cd app
npm install
npm run dev -- --host 127.0.0.1 --port 5174
```

Open `http://127.0.0.1:5174` — dark neon Europe map (MapLibre + OSM/Carto dark labels), toggles for road/rail/aircraft/industry and Lden/Lnight. Contour PMTiles live in `app/public/data/`.

Other scripts (from `app/`):

- `npm run build` — production build
- `npm run preview` — preview the production build
- `npm run lint` — lint

## Stack notes

- **Analysis:** Python + marimo; geopandas/pyogrio for contour area EDA (no PMTiles yet)
- **Front end:** Vite, React, TypeScript, D3, MapLibre GL (OSM-friendly). MapLibre is installed; the UI currently shows a stub only — no tiles / Map instance yet.
- **Hosting:** later (GitHub Pages or Netlify)

## Project store resources

Curated source lists live in the Project Agent Store (not duplicated here):

- Europe / EEA END + health: `/cursor/stores/self/docs/europe-noise-active-resources.md`  
  (also `/cursor/stores/bc-36eb9549-bf41-46b2-908b-412b53810f5d/docs/europe-noise-active-resources.md`)
- Asia city noise: `/cursor/stores/self/docs/asia-city-noise-resources.md`  
  (also `/cursor/stores/bc-36eb9549-bf41-46b2-908b-412b53810f5d/docs/asia-city-noise-resources.md`)

## Data policy

- **EEA END 2022** exposure + contours: download under `data/raw/eea-end/` (large contour packages stay local / gitignored).
- **Asia** and other extras: still wait for explicit approval before downloading.
- Processed outputs committed only when small (CSV summaries).

## Reference viz projects

Local convention / idea references live under `~/Documents/projects/dataviz/` (not `~/Documents/dataviz/`). Closest layout cousins: `pacific-dataviz-2026` (`analysis/` + `data/` + front end) and Vite+React+D3 apps such as `energy-dashboard` / `d3-intro-page`. Spatial/Python patterns: `natura2000-interactive`.
