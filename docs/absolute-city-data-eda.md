# Absolute city noise downloads — EDA

**Scope:** Local files under `noise-pollution-dataviz/data/raw/` as of 18 Nov 2026 (Europe/Zurich); HK added same morning.  
**Cross-check:** [`absolute-noise-downloadable-data.md`](./absolute-noise-downloadable-data.md).  
**Insights / viz params:** [`absolute-city-insights.md`](./absolute-city-insights.md).  
**Not included:** EEA END (modelled), geocode cache, Eurostat Annex.

---

## Inventory vs expectations

| Expected (catalog) | Local status |
| --- | --- |
| Madrid SIVCA daily + stations | **Daily CSV present** (~43 MB). **Stations CSV missing** |
| Paris Bruitparif annual road | **Present** (tiny wide CSV, ~3 KB) |
| Korea KECO auto daily Leq | **Present** (~13 MB, **2024 only**) |
| Hong Kong EPD 2020 L₁₀ map | **Present** — GeoTIFF (+ zip) under `hong_kong/` (~63 MB). **No district >70 dB HTML tables** |
| Japan NIES / Barcelona / Dublin / Survol Excel | **Absent** |
| Taiwan NOS_P_08 stations | **Present** at `data/raw/nos_p_08.csv` (inventory only; not a city levels dump) |

Folders found: `madrid/`, `paris/`, `korea/`, `hong_kong/`.

---

## Madrid — `madrid/Ruido_diario_acumulado.csv`

| | |
| --- | --- |
| **Size** | 44 923 104 B (~43 MB) |
| **Encoding / delim** | Latin-1; semicolon |
| **Rows** | **1 042 426** (excl. header) |
| **Stations** | **36** numeric IDs (`1`…`36` with gaps) |
| **Years** | **1998 → 2026** |
| **Grain** | **Daily × period** D / E / N / T (day / evening / night / 24 h) |
| **Metrics** | `LAeq`, `L1`, `L10`, `L50`, `L90`, `L99` (comma decimals; early years often `N/D` on percentiles — LAeq filled; ~686k rows have L10) |

**Sample header:** `Estación;Año;Mes;Día;Periodo;LAeq;L1;L10;L50;L90;L99`

**Use for scrolly / city zoom**
- Long **LAeq** timeline (25+ years) for one station vs city median — “Madrid got quieter / louder at night”.
- **L10 vs L90** spread as “peakiness” vs background; pair with common-sounds anchors (conversation ~60 dB).
- Period strip: D vs N gap for the same day (traffic / nightlife).
- Map pins need the **missing stations file** (lat/lon + names) before geographic zoom.

**Caveats:** Point monitors ≠ END population×band. No coords in this file. Percentiles sparse early. Measured LAeq ≠ modelled Lden.

---

## Paris — `paris/bruit-evolution-de-l-indice-du-bruit-mesure-sur-des-stations-parisiennes.csv`

| | |
| --- | --- |
| **Size** | 3 120 B |
| **Encoding / delim** | UTF-8 BOM; semicolon |
| **Rows** | **16** years (2010–2025, unsorted) |
| **Places** | **17 sites × {Lden, Ln}** = 34 metric columns (périphérique Auteuil/Vincennes, Courcelles, Poissonière, Sébastopol, Rivoli, Bastille, Frémicourt, Lecourbe, …) |
| **Grain** | **Annual** measured road **Lden** / **Ln** |
| **Fill** | Sparse early (2010: 2/34; 2011: 4/34); dense recent (2024–2025: 34/34) |

**Use for scrolly / city zoom**
- Small multiples / slope chart: périphérique vs calmed street Lden over years.
- Direct **Lden/Ln** language next to Europe END story — label “measured at site ≠ citywide END”.
- Highlight night (Ln) on boulevard vs residential side-street.

**Caveats:** Wide format; many blanks historically. Site Lden ≠ agglomeration END exposure counts. No lat/lon in file (names only).

---

## Korea — `korea/한국환경공단_소음진동측정망 운영정보_20241231.csv`

| | |
| --- | --- |
| **Size** | 13 484 613 B (~13 MB) |
| **Encoding / delim** | UTF-8 BOM; comma |
| **Rows** | **144 926** |
| **Years** | **2024 only** (daily dates) |
| **Grain** | **Daily** average noise level (`소음도`) |
| **Columns** | `번호, 도시, 법적, 용도구분, 측정지점, 지역, 측정일, 소음도` → id, city, legal zone class (가/나/다), land-use, site name, area type (도로/일반), date, **Leq-like dB** |
| **Cities** | National: Daejeon largest (~55k rows); **Seoul 2 476 rows / 8 road sites** only (회기동, 성북초교, 불광동, …) |
| **Sites** | ~456 city×point×type combos |

**Use for scrolly / city zoom**
- Seoul **2024 daily road Leq** calendar / sparkline for the 8 sites.
- Zone-class colouring (가/나/다) as “legal class vs measured” for Asia contrast vs EU.
- City picker beyond Seoul if the story goes national (Daejeon/Busan denser than Seoul in this dump).

**Caveats:** Single year. Korean zone classes ≠ EU END. No lat/lon here (need stations file 15093409 from catalog). Seoul sample is thin vs other metros in this extract.

---

## Hong Kong — `hong_kong/`

| File | Size | Format |
| --- | ---: | --- |
| `2020_L10_1_hour_at_4m_GEOTIFF.zip` | 31 665 780 B (~31 MB) | ZIP (same 5 files as `L10/`) |
| `L10/4M_CombinedHK_L10.tif` | 28 323 768 B (~27 MB) | GeoTIFF, float64, DEFLATE |
| `L10/4M_CombinedHK_L10.tif.ovr` | 5 309 854 B (~5.1 MB) | Overview pyramid |
| `L10/4M_CombinedHK_L10.tfw` | 91 B | World file (10 m cells) |
| `L10/4M_CombinedHK_L10.tif.aux.xml` | 1 594 B | PAM histogram |
| `L10/4M_CombinedHK_L10.tif.xml` | 613 B | ArcGIS lineage |

| | |
| --- | --- |
| **Metric** | Peak-hour **L₁₀ (1 h)** at **4 m** (traffic noise map 2020; filename + EPD catalog) |
| **Places** | **Territory-wide** raster (combined HK), not station points |
| **Year / grain** | Strategic map year **2020** (single snapshot — not a time series) |
| **Grid** | **10 m** cells; **4855 × 3744** ≈ **18.2 M** pixels; HK1980 Grid from world file (~X 804000→852550, Y 845930→808490) |
| **Values** | Float dB; PAM hist ~−32…97 (negatives / edges = nodata-ish); lineage `PointToRaster` … `L10` … `MAXIMUM` … `10` |
| **Row count** | N/A (raster); zip = duplicate of extracted `L10/` |

**Use for scrolly / city zoom**
- Full-bleed **L₁₀ heatmap** for Asia “mapped city” beat (zoom Harbour / Kowloon corridors).
- Threshold mask **>70 dB(A) L₁₀** as area share (proxy until district exposure HTML is added).
- Side-by-side with Madrid **measured L10** (point) vs HK **mapped L10** (surface) — label metrics carefully.

**Caveats:** **L₁₀ ≠ Lden**; strategic/modelled-style traffic map, not continuous monitors. No people-exposure table in this download (catalog’s district HTML still missing). CRS is projected HK grid — reproject for web maps. Keep zip or `L10/` (duplicate).

---

## Taiwan (bonus) — `nos_p_08.csv` (repo root of `data/raw/`)

| | |
| --- | --- |
| **Size** | ~54 KB |
| **Rows** | **320** active stations |
| **Content** | Inventory: id, county, name, area/noise type, address, **lon/lat**, road width |
| **Taipei** | 24 stations in 臺北市 |

**Use:** Map dots / join key for future hourly packs — **no dB time series** in this file. Matches catalog caveat (NOS_P_08 = inventory-heavy).

---

## What to use (short)

1. **Madrid** — primary Europe absolute storytelling: long daily LAeq (+ L10 when present); add stations CSV before map.
2. **Paris** — compact annual measured **Lden/Ln** by named road sites; best “speak END language with monitors”.
3. **Hong Kong** — Asia mapped-city **2020 L₁₀** GeoTIFF for heatmap / >70 dB mask; add district exposure HTML if people-% needed.
4. **Korea 2024** — Asia daily Leq; Seoul only 8 road points; needs station coords.
5. **Taiwan NOS_P_08** — station map only until hourly CSVs arrive.

**Scrolly-ready without new downloads:** Madrid time series + Paris annual site Lden/Ln + HK L₁₀ raster. **Blocked for maps:** Madrid & Korea missing station coordinates; HK district people-exposure tables still absent.
