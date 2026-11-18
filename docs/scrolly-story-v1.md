# Scrolly story v1 — copy, metrics, years

**App:** sticky MapLibre + left progress rail + Holtz-style steps (`app/src/scrolly/`).  
**Metrics JSON:** `app/public/data/scrolly_story_v1.json` (= `data/processed/scrolly/story_v1_metrics.json`).  
**Run:** `cd app && npm run dev -- --host 127.0.0.1 --port 5173` → hard-refresh.

No temporal trend charts — **snapshot years only**, always labelled.  
**UI copy rule:** no metric jargon in reader-facing text (no Lden / Ln / LAeq / L₁₀ / Leq). Use plain language (“night noise at this road site”, “peak traffic noise”, “day–evening–night long-term”). Internal map props may still use END metric codes.

---

## Step 0 — Hero

| | |
| --- | --- |
| **Title** | How loud is the city? |
| **Map** | Europe overview, road · day–evening–night |

---

## Step 1 — Europe (label year **2021**)

**Both beats stay on this step (Fotini):** (a) people above WHO guidance, and (b) highly annoyed. The **>75 dB** high-band story is a **separate later beat** (Germany), not mixed into Europe.

| Question | Answer (v1 numbers) |
| --- | --- |
| How many people experience sound louder than WHO suggestions? | **~74.1 million** people in official agglomeration bands that already sit above WHO road guidance (maps start counting from levels past those guidelines; practical exceedance proxy) |
| How many people in Europe are highly annoyed by the sounds? | **~12.5 million** highly annoyed; also **~3.3 million** highly sleep-disturbed — road/rail/aircraft, WHO exposure–response × official bands |

**Sources:** `exposure_agglomeration_who_ha_hsd.csv` (END 2022 round → story year label **2021**).

---

## Step 2 — Germany · Berlin (high-band share)

| | |
| --- | --- |
| **Agglomeration** | **Berlin** (Fotini: not Cologne) |
| **Frame** | Share of high-dB exposure: “**X** people on high dBs, **Y%** in Berlin” |
| **Year** | **2021** |
| **High band** | Top band **>75 dB** day–evening–night, **road + rail + aircraft** in German agglomerations |
| **Numbers** | Germany **110,200** people · Berlin **11,400** → **10.3%** of Germany’s high-band total (~**2.4%** of Europe’s **480,800**) |
| **Road-only (secondary)** | Germany **97,000** · Berlin **3,400** → **3.5%** of DE road high-band — not the headline frame |
| **Common sound** | **Busy street / city traffic** · **75–90 dB** — **placeholder** until Fotini picks from options below |
| **Map** | Fly to Berlin; highlight `Germany\|Berlin` |

### ~75 dB common-sound options (pending pick)

From `docs/common-sounds-db-levels.csv` / store table — near the high band; **do not lock** until Fotini chooses:

| Sound | dB range |
| --- | --- |
| Vacuum cleaner | 70 |
| Busy street / city traffic (roadside snapshot) | 75–90 *(current placeholder)* |
| Aircraft cabin in cruise | 72–83 |
| Coffee shop / noisy restaurant | 80 |
| Inside car in city traffic | 85 |

---

## Step 3 — Paris

| | |
| --- | --- |
| **Year** | **2025** |
| **Plain language** | Night noise at this road site |
| **Loudest site** | **Périphérique Vincennes** |
| **Max dB** | **77.5 dB** |
| **Common sound** | Aircraft cabin in cruise · **72–83 dB** |
| **Question angle** | Which site had the highest night level in 2025? What everyday sound sits near that? |

*(Wording OK for now; keep metric names out of UI.)*

---

## Step 4 — Madrid

| | |
| --- | --- |
| **Year** | **2026** (most recent year in SIVCA nightly extract) |
| **Plain language** | Night noise at this monitoring station |
| **Loudest focus station** | **ID 6** |
| **Max dB** | Median **64.4 dB**; peak reading **80.4 dB** (same station) |
| **Common sound (median)** | Normal conversation · **60–65 dB** |
| **Question angle** | Which focus station is loudest at night in 2026? What does that feel like? |

*(Wording OK for now; keep metric names out of UI.)*

---

## Step 5 — Hong Kong

| | |
| --- | --- |
| **Year** | **2020** |
| **Plain language** | Peak traffic noise on the 2020 map |
| **Max on grid** | **~96.8 dB** |
| **Common sound** | Jet flyover outdoors (≈1000 ft) · **88–103 dB** |
| **Very loud extent** | **~23.0%** of valid cells **>70 dB** → **~96.9 km²** — **confirmed** (Fotini: >70 for area) |
| **Method (internal)** | Valid cells = finite peak-traffic values ∈ [30, 100]; count >70; each cell **10×10 m** → area. **Not** road-km. |

---

## Step 6 — Seoul

| | |
| --- | --- |
| **Year** | **2024** |
| **Plain language** | Daily road noise at this site |
| **Loudest site** | **북아현동** |
| **Max dB** | Median **73.4 dB**; file peak **76.6 dB** (숙명여고 앞) |
| **Common sound (median)** | Vacuum cleaner · **70 dB** (nearest mid) / busy street band also nearby |

---

## Step 7 — Explore

Full interactive map: source/metric toggles, hover/pin, ThemeRiver.

---

## UI notes

- Left **progress rail** (clickable stops).  
- Map **sticky full-bleed**; step cards scroll over left.  
- Controls locked to step source/metric until Explore.  
- Years labelled on each beat.  
- Reader copy: plain language only for measured noise; map layer codes stay internal.
