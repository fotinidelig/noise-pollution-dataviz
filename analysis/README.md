# Analysis

Python scripts + marimo notebooks for EEA END 2022 exposure and contour EDA.

## Setup

```bash
cd analysis
uv venv .venv --python 3.12
uv pip install --python .venv/bin/python -r requirements.txt
source .venv/bin/activate
```

## Scripts

| Script | Purpose |
| --- | --- |
| `scripts/download_eea_end.py` | Resume-friendly download of exposure Excel + country contour packages |
| `scripts/process_exposure.py` | Excel → tidy/summary CSVs in `data/processed/eea-end/` |
| `scripts/process_contours.py` | GeoPackage area aggregates by dB class × source × country |

## Notebook

```bash
marimo edit notebooks/end_2022_exposure_contours_eda.py
```

Style loosely follows the pacific-dataviz marimo notebooks (markdown sections + matplotlib charts).

## Notes

- Raw contour GeoPackages are multi‑tens of GB and **gitignored**.
- Contour processing writes small CSV summaries only (no PMTiles / web assets).
- Children BoD is out of scope for this sprint notebook.
