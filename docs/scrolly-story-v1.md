# Scrolly story v1 — copy, metrics, years

**App:** sticky MapLibre + left progress rail + Holtz-style steps (`app/src/scrolly/`).  
**Metrics JSON:** `app/public/data/scrolly_story_v1.json`.  
**Run:** `cd app && npm run dev -- --host 127.0.0.1 --port 5173` → hard-refresh.

**Cards:** insight paragraphs only (no question lists). Key numbers/insights use cyan/magenta `.scrolly-hi` spans.  
**Dismiss UX:** every story card has **×**. It hides the narrative overlay and jumps to **Explore** (free pan/zoom). A progress-rail click reopens that beat.  
**Scroll ownership:** until Explore, map pan/zoom is disabled — wheel drives the story. “Scroll” chevron cue on non-explore beats.  
**Overlays:** HK raster + Seoul bubbles unlock on first visit and **stay visible** afterward (scroll-back friendly). HK color bar shows **only on the Hong Kong step** (under that card). Seoul/HK hover tooltips show dB.

**Common-sound paradigm:** vacuum (~70 dB) ↔ blender (~80–90 dB). ~75 dB is between them; louder → blender.  
**Perception rule (NIDCD rule of thumb):** each **+10 dB ≈ twice as loud**. Story contrasts use doubling steps (2×, 4×, ~6–8×…). Not calibrated browser audio.  
**UI:** no legend; rail = line + circles; no metric jargon in copy; years labelled.

**City zooms (MapLibre):** Berlin **7.1** · Paris **9.2** · Madrid **9.0** · Hong Kong **8.7** · Seoul **8.9**.

---

## Insight copy (Fotini pass + loudness doubling)

**Rule (state once on Europe):** each **+10 dB ≈ twice as loud** (NIDCD rule of thumb). Express contrasts as doubling steps; round with “about / roughly”. Magenta only for very loud sounds. Do **not** claim browser audio is calibrated.

### Intro

**Do you hear the birds?**  
Or are our cities too loud? We’ll look at noise levels around Europe and the world to find out.

### Europe (2021) — People are quite annoyed by the noise

About **74.1 million** people in European cities live in official **noise levels** that already sit above **WHO road-traffic guidance (~53 dB)**. Roughly **12.5 million** people are **highly annoyed** by road, rail, or aircraft noise.  
As a rule of thumb, each **+10 dB** sounds about **twice** as loud. Exposure at **≥75 dB** is about **4×** as loud as **55dB**. That is the world those highly annoyed people live in.

### Germany · Berlin (2021)

Title: **110k people must listen to a vacuum cleaner all day — 10.3% in Berlin**  
About **110k** people above **75 dB**; **~11k (10.3%)** in Berlin.  
**75 dB** sits between a **vacuum cleaner (~70 dB)** and a **blender (~80–90 dB)**.

### Paris (2025)

**Périphérique Vincennes** night ~**77.5 dB**.  
Vs **vacuum (~70)**: **+~7–8 dB** → approaching **twice as loud** (almost one doubling).

### Madrid (2026)

Station **6** typical night ~**64 dB**, peaks ~**80 dB**.  
Peak vs typical **+~16 dB ≈ ~3×**; peak vs vacuum **+~10 dB ≈ ~2×**.

### Hong Kong (2020)

~**23%** of mapped territory above **70 dB** (~**97 km²**). Loudest ~**97 dB**.  
From **70 → 97**: **+~27 dB ≈ ~6–8× as loud** (~2½–3 doublings); past a blender.

### Seoul (2024)

**Bukahyeon-dong** highest mean ~**73 dB**; peak ~**77 dB** at **Sookmyung Girls' HS (front)**. Near vacuum; short of a full doubling above it; peak leans toward blender.

### Calm — Places where you might hear birds

Grand Canyon night ~**15 dB**; Berlin park ~**49 dB**.  
Canyon → vacuum **+~55 dB ≈ five–six doublings (~30–60×)**; Berlin park → traffic **~75**: **+~26 dB ≈ ~6×**. Distant birds **44–60 dB**; dawn ambient **~45–50**.

### Explore

Zoom into **countries** or **cities** for exposure and impacts on **human annoyance** and potential **sleep disturbance**.

---

## Overlays

| Step | Asset |
| --- | --- |
| Hong Kong | `app/public/data/hong_kong_l10_overlay.png` + `.json` (EPSG:2326→WGS84 corners) |
| Seoul | `app/public/data/seoul_road_sites.geojson` — `name_en` labels; Korean kept in `name_ko` |

Seoul Latin names: Bukahyeon-dong, Sookmyung Girls' HS (front), IBK / corporate bank site, Banpo-bon-dong, Samsin Building, Hoegi-dong, Bulgwang-dong, Seongbuk Elementary.
