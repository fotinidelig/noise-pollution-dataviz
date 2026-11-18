# Absolute city noise — insights & viz params

**Date:** 18 Nov 2026 (Europe/Zurich) · Metrics locked by Fotini.  
**Notebooks:** `analysis/notebooks/{madrid_night_laeq,paris_ln_lden,korea_daily_leq,hong_kong_l10}.py`  
**Processed extracts:** `data/processed/absolute-cities/` (+ `insights_summary.json`)  
**EDA inventory:** [`absolute-city-data-eda.md`](./absolute-city-data-eda.md)

**Shared viz rules:** no common-sounds reference lines for now. Aggregate only when it helps the city story; keep distinctive named sites.

---

## Madrid — night LAeq

**Finding:** City-wide night median fell **63.7 → 55.7 dB** (1998 → 2026), but stations diverge sharply.  
**Focus stations (eligible: ≥1000 nights, active ≥2020):**

| Role | Station ID | Median night LAeq | Note |
| --- | ---: | ---: | --- |
| Loudest | **6** | **66.4** | Persistently loud |
| Distinctive | **28** | **59.9** | Highest L10−L90 spread (~24 dB) |
| Calmest | **24** | **45.4** | ~21 dB quieter than #6 |

**Viz params**
- Chart: yearly median night LAeq for stations **6 / 28 / 24** + dashed city median context  
- Y: **45–75 dB**; optional secondary L10−L90 for #28  
- Map: blocked until stations CSV (lat/lon + names)

**Caveats:** Point monitors; LAeq ≠ Lden; early L10/L90 often missing; IDs not place names yet.

---

## Paris — Ln (+ Lden companion)

**Finding (2025 Ln):** loudest **Périphérique Vincennes 77.5 dB**; calmest **13 rue Frémicourt (enrob-clas) 62.7 dB**; site median **66.5 dB** (17 sites). Keep périphérique segments named — do not merge.

**Focus sites:** Périphérique Vincennes · Périphérique Auteuil · 13 rue Frémicourt (enrob-clas).

**Viz params**
- Primary: Ln time series for those three named sites  
- Companion: Ln vs Lden scatter for latest year  
- Y Ln: **55–85 dB**

**Caveats:** Annual monitors only; sparse early years; site Lden ≠ END citywide exposure.

---

## Korea — Seoul daily road Leq (2024 only)

**Finding:** **8** Seoul road sites. Loudest **북아현동** median **73.4 dB** (zone 나); calmest **성북초교** **64.6 dB** (나). Median of site medians **~71.2 dB**. Zones: 나×5, 가×3.

**Viz params**
- All **8** site daily lines + dashed Seoul-road median  
- Bar of site medians coloured by **법적** (가/나/다)  
- Y: **50–80 dB** · **Seoul-only stop**

**Caveats:** Single year; no lat/lon in this file; Korean zone classes ≠ EU END.

---

## Hong Kong — 2020 L₁₀ (1 h @ 4 m)

**Finding (downsample step 8, valid cells L₁₀∈[30,100]):** median **~59.6 dB**, p90 **~76.8**, max **~96.1**.  
**% valid cells >70 dB: ~22.9%** ( >75 ~13.0%, >80 ~5.8%).

**Viz params**
- Magma heatmap vmin/vmax **50–85**; >70 mask overlay  
- Preview: `hong_kong_l10_preview.npz` (468×607); reproject HK grid for web  
- Optional scrolly beat: “~1 in 4 mapped cells above 70 L₁₀”

**Caveats:** L₁₀ ≠ Lden; strategic 2020 traffic map (not monitors); no district people-exposure HTML in download; zip duplicates `L10/`.

---

## Blockers

1. Madrid & Korea — **station coordinates / names** still missing for map zoom.  
2. Hong Kong — **district >70 people %** tables not downloaded.  
3. Paris — no coords (names only; fine for line charts).

## Suggested scrolly order

1. Madrid night LAeq stations 6 vs 24 (+ city fade)  
2. Paris Ln périphérique vs calmed street  
3. HK L₁₀ heatmap → >70 mask  
4. Seoul 2024 road Leq strip (8 sites)
