# Noise pollution dataviz

Interactive website exploring **Europe environmental noise** (EEA END exposure + WHO / EU thresholds — threshold choice TBD), with nature dB as a reference layer and Asia city data for comparison later. Sound interactivity planned; children BoD deferred for now.

Audience: general public + portfolio. Sprint deliverable: a Vite + React + D3 site on an OpenStreetMap-based map (MapLibre).

## Repository structure

```
noise-pollution-dataviz/
├── analysis/          # Python scripts + marimo notebooks
├── data/
│   ├── raw/eea-end/   # END exposure Excel + contour GPKGs (large; gitignored)
│   ├── raw/eurostat/  # SILC Annex 5 PDF, etc.
│   └── processed/     # Small CSV summaries for EDA / later viz
├── docs/              # Short sources note (Europe active resources)
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

Curated source lists (Agent Store + short repo mirror):

- Europe / EEA END + health + SILC + WHO HA/HSD: [`docs/europe-noise-active-resources.md`](docs/europe-noise-active-resources.md)  
  (canonical store: `/cursor/stores/self/docs/europe-noise-active-resources.md`)
- Asia city noise: `/cursor/stores/self/docs/asia-city-noise-resources.md`

## Key processed tables

- WHO HA/HSD people (agglomeration × source): `data/processed/eea-end/exposure_agglomeration_who_ha_hsd*.csv`
- SILC noise perception 2023 + Annex 5 sample *n*: `data/processed/eurostat/ilc_mddw01_2023_noise_with_sample_size.csv`

## Data policy

- **EEA END 2022** exposure + contours: download under `data/raw/eea-end/` (large contour packages stay local / gitignored).
- **Eurostat SILC** Annex 5 PDF under `data/raw/eurostat/`; small processed CSV committed.
- **Asia** and other extras: still wait for explicit approval before downloading.
- Processed outputs committed only when small (CSV summaries).

## Reference viz projects

Local convention / idea references live under `~/Documents/projects/dataviz/` (not `~/Documents/dataviz/`). Closest layout cousins: `pacific-dataviz-2026` (`analysis/` + `data/` + front end) and Vite+React+D3 apps such as `energy-dashboard` / `d3-intro-page`. Spatial/Python patterns: `natura2000-interactive`.
