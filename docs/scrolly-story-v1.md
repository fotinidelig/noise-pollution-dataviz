# Scrolly story v1 — copy, metrics, years

**App:** sticky MapLibre + left progress rail + Holtz-style steps (`app/src/scrolly/`).  
**Metrics JSON:** `app/public/data/scrolly_story_v1.json`.  
**Run:** `cd app && npm run dev -- --host 127.0.0.1 --port 5173` → hard-refresh.

**Cards:** insight paragraphs only (no question lists). Key numbers/insights use cyan/magenta `.scrolly-hi` spans.  
**Dismiss UX:** every story card has **×**. It hides the narrative overlay and jumps to **Explore** (free pan/zoom). A progress-rail click reopens that beat.  
**Scroll ownership:** until Explore, map pan/zoom is disabled — wheel drives the story. “Scroll” chevron cue on non-explore beats.  
**Overlays:** HK raster + Seoul bubbles unlock on first visit and **stay visible** afterward (scroll-back friendly). HK color bar shows **only on the Hong Kong step** (under that card). Seoul/HK hover tooltips show dB.

**Common-sound paradigm:** vacuum (~70 dB) ↔ blender (~80–90 dB). ~75 dB is between them; louder → blender.  
**UI:** no legend; rail = line + circles; no metric jargon in copy; years labelled.

**City zooms (MapLibre):** Berlin **7.1** · Paris **9.2** · Madrid **9.0** · Hong Kong **8.7** · Seoul **8.9**.

---

## Insight copy (Fotini pass)

### Europe (2021) — only this

About **74.1 million** people in European cities live in official noise bands that already sit above **WHO road-traffic guidance**. From the same maps, roughly **12.5 million** people are **highly annoyed** by road, rail, or aircraft noise.

### Germany · Berlin (2021)

In German cities, about **110k** people live with long-term day–evening–night averages above **75 dB**. Of them, about **11k** — **10.3%** — are in Berlin.  
**75 dB** sits between a **vacuum cleaner (~70 dB)** and a **blender (~80–90 dB)**.

### Paris (2025)

In 2025, night noise at the loudest Paris road site in this set — **Périphérique Vincennes** — reaches about **77.5 dB**.  
For scale: **between a vacuum cleaner (~70 dB) and a blender (~80–90 dB) — around 78 dB**.

### Madrid (2026)

Station **6** = **fixed outdoor noise monitoring station** (not metro).  
In 2026, night noise at fixed outdoor noise monitoring station **6** sits around **64 dB** on a typical night, with peaks near **80 dB**.  
Typical: quieter than a vacuum cleaner (~70 dB) — around 64 dB. Peak: toward a blender (~80–90 dB) — around 80 dB.

### Hong Kong (2020)

About **23%** of the mapped territory sits above **70 dB** (~**97 km²**). Loudest places ~**97 dB** (louder than a blender). No “cells” wording — use mapped area / territory.

### Seoul (2024)

Title: **Seoul: highest mean at Bukahyeon-dong**.  
Among eight Seoul road sites, **Bukahyeon-dong** has the **highest mean** (~**73 dB**). Highest single reading ~**77 dB** at **Sookmyung Girls' HS (front)**. Vacuum/blender compares on mean and peak.

---

## Overlays

| Step | Asset |
| --- | --- |
| Hong Kong | `app/public/data/hong_kong_l10_overlay.png` + `.json` (EPSG:2326→WGS84 corners) |
| Seoul | `app/public/data/seoul_road_sites.geojson` — `name_en` labels; Korean kept in `name_ko` |

Seoul Latin names: Bukahyeon-dong, Sookmyung Girls' HS (front), IBK / corporate bank site, Banpo-bon-dong, Samsin Building, Hoegi-dong, Bulgwang-dong, Seongbuk Elementary.
