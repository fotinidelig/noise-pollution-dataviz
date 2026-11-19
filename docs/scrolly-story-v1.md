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

**Rule (state once on Sounds):** each **+10 dB ≈ twice as loud** (NIDCD rule of thumb). Express contrasts as doubling steps; round with “about / roughly”. Magenta only for very loud sounds. Do **not** claim browser audio is calibrated.

### Intro

**Do you hear the birds?**  
Or are our cities too loud? We’ll look at noise levels around Europe and the world to find out.

### Sounds — But what does noise feel like? *(2nd beat, right after intro)*

As a rule of thumb, each **+10 dB** sounds about **twice** as loud. Exposure at **≥75 dB** is about **4×** as loud as **55dB**. That is the world those highly annoyed people live in.  
According to WHO, people experiencing **sleep disturbances** are chronically exposed to more than **70 dB** at night.

Horizontal quiet→loud ladder (equally spaced markers; click-to-play `app/public/audio/*.mp3`):

| Label | Anchor | Clip |
| --- | --- | --- |
| Water stream | ~40–50 dB | `water-stream.mp3` |
| Birds | ~44–60 dB | `birds-singing.mp3` |
| Vacuum | **~70 dB** (HSD threshold highlight) | `vacuum-cleaner.mp3` (Freesound 76618) |
| Blender | **~80–90 dB** | `blender.mp3` (Freesound 72304) |
| Motorcycle | ~90 dB (loud end) | `freesound_community-motorcycle-77112.mp3` (Freesound 77112) |

While a sample plays: full-screen visible particle grain (count ∝ 2^((dB−45)/10), 2× per +10 dB) dims the map; only the playing column’s pulse rings animate.

Browser playback is **not** calibrated SPL — clips show character; labels carry the dB anchors. Clips are peak-normalized to a shared max amplitude.

### Europe (2021) — Noise pollution disturbs millions

About **74.1 million** people in European cities live in official **noise levels** that already sit above **WHO road-traffic guidance (~53 dB)**. Roughly **12.5 million** people are **highly annoyed** by road, rail, or aircraft noise.

### Germany · Berlin (2021)

Title: **110k people must listen to a vacuum cleaner all day — 10.3% in Berlin**  
About **110k** people above **75 dB**; **~11k (10.3%)** in Berlin.  
**75 dB** sits between a **vacuum cleaner (~70 dB)** and a **blender (~80–90 dB)**.

### Paris (2025 site · 2021 END road HA/HSD)

**Périphérique Vincennes** night ~**77.5 dB**, between a **vacuum cleaner (~70 dB)** and a **blender (~80–90 dB)**.  
According to the data for road maps in Paris, about **993k** people are **highly annoyed** and about **271k** are **highly sleep disturbed** due to traffic noise.

### Madrid (2026)

In **2026**, night noise at **fixed outdoor noise monitoring station 6** sits around **64 dB** on a typical night, with peaks near **80 dB**. Yes, that's **2 times** the noise of a **vacuum cleaner**.

### Hong Kong (2020)

Title: **In Hong Kong more than 1 million people are exposed to road traffic higher than 70dBs**.  
At least **1 million** Hong Kong residents have to live with road traffic noise above **70 dB**.  
On the **2020** Hong Kong **citywide traffic-noise map** (modelled area levels, not one microphone), about **23%** of the mapped territory sits above **70 dB** — roughly **97 km²**.

### Seoul (2024)

**Title:** In Seoul the highest average noise is around Bukahyeon-dong.

Among eight Seoul road sites, **Bukahyeon-dong** has the **highest mean** (~**73 dB**). Highest single reading ~**77 dB** at the monitoring site at **Sookmyung Girls' High School (front gate)** (`숙명여고 앞`).

### Calm — Places where you might hear birds

A Grand Canyon fall night near **15 dB** is quieter than a **whisper (~25–30 dB)**; a Berlin park hour near **49 dB** is calm for a city, not silent.  
From Berlin’s park hour to mapped traffic at **~75 dB** is about **+26 dB** — roughly **6× as loud**.  
Distant bird calls **44–60 dB**; dawn ambient **~45–50**; Denali / Haleakalā leave headroom to hear birds; Stockholm parks ~**55 dB** — still nowhere near a blender.

### Explore

Zoom into **countries** or **cities** for exposure and impacts on **human annoyance** and potential **sleep disturbance**.

---

## Overlays

| Step | Asset |
| --- | --- |
| Hong Kong | `app/public/data/hong_kong_l10_overlay.png` + `.json` (EPSG:2326→WGS84 corners) |
| Seoul | `app/public/data/seoul_road_sites.geojson` — `name_en` labels; Korean kept in `name_ko` |

Seoul Latin names: Bukahyeon-dong, Sookmyung Girls' High School (front gate), IBK / corporate bank site, Banpo-bon-dong, Samsin Building, Hoegi-dong, Bulgwang-dong, Seongbuk Elementary.
