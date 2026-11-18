# Scrolly story v1 — copy, metrics, years

**App:** sticky MapLibre + left progress rail + Holtz-style steps (`app/src/scrolly/`).  
**Metrics JSON:** `app/public/data/scrolly_story_v1.json`.  
**Run:** `cd app && npm run dev -- --host 127.0.0.1 --port 5173` → hard-refresh.

**Cards:** insight paragraphs only (no question lists). Key numbers/insights use cyan/magenta `.scrolly-hi` spans.  
**Dismiss UX:** every story card has **×**. It hides the narrative overlay and jumps to **Explore** (free pan/zoom). A progress-rail click reopens that beat.  
**Scroll ownership:** until Explore, map pan/zoom is disabled — wheel drives the story. “Scroll” chevron cue on non-explore beats.  
**Overlays:** HK raster + Seoul bubbles unlock on first visit and **stay visible** afterward (scroll-back friendly). HK color bar sits under the active story card (same width). Seoul/HK hover tooltips show dB.

**Common-sound paradigm:** vacuum (~70 dB) ↔ blender (~80–90 dB). ~75 dB is between them; louder → blender.  
**UI:** no legend; rail = line + circles; no metric jargon in copy; years labelled.

**City zooms (MapLibre):** Berlin **7.1** · Paris **9.2** · Madrid **9.0** · Hong Kong **8.7** · Seoul **8.9**.

---

## Flow (bridged)

0. **Hero** — title only: `do you hear the birds?`  
1. **Europe (2021)** — WHO exceedance + highly annoyed → tees Germany high band  
2. **Berlin share** — high-dB people + vacuum/blender for 75 dB → tees Paris night measures  
3. **Paris night** → tees Madrid typical vs peak  
4. **Madrid night** → tees HK territory surface  
5. **Hong Kong** — peak-traffic overlay + >70 area → tees Seoul site bubbles  
6. **Seoul** — Latin labels; bubble size = mean dB; approx geocodes → explore  
7. **Explore**

---

## Overlays

| Step | Asset |
| --- | --- |
| Hong Kong | `app/public/data/hong_kong_l10_overlay.png` + `.json` (EPSG:2326→WGS84 corners) |
| Seoul | `app/public/data/seoul_road_sites.geojson` — `name_en` labels; Korean kept in `name_ko` |

Seoul Latin names: Bukahyeon-dong, Sookmyung Girls' HS (front), IBK / corporate bank site, Banpo-bon-dong, Samsin Building, Hoegi-dong, Bulgwang-dong, Seongbuk Elementary.
