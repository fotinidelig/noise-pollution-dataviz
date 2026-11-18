# Scrolly story v1 — copy, metrics, years

**App:** sticky MapLibre + left progress rail + Holtz-style steps (`app/src/scrolly/`).  
**Metrics JSON:** `app/public/data/scrolly_story_v1.json` (= `data/processed/scrolly/story_v1_metrics.json`).  
**Run:** `cd app && npm run dev -- --host 127.0.0.1 --port 5173` → hard-refresh.

No temporal trend charts — **snapshot years only**, always labelled.

---

## Step 0 — Hero

| | |
| --- | --- |
| **Title** | do you hear the birds? |
| **Map** | Europe overview, road · Lden |

---

## Step 1 — Europe END (label year **2021**)

| Question | Answer (v1 numbers) |
| --- | --- |
| How many people in Europe are HA by the sounds? | **~12.5 million** highly annoyed (HA); also **~3.3 million** HSD — agglomeration road/rail/aircraft, WHO ERFs × END bands |
| How many people experience sound louder than the WHO suggestions? | **~74.1 million** people in END **Lden** bands (≥55 dB reporting). WHO road guidance ~**53 dB Lden** → END bands used as practical proxy |

**Sources:** `exposure_agglomeration_who_ha_hsd.csv` (END 2022 round → story year label **2021**).

---

## Step 2 — Germany · Cologne

| | |
| --- | --- |
| **Agglomeration chosen** | **Cologne** — most people in road **Lden >75** among German agglomerations (**12,200** people) |
| **Year** | **2021** |
| **Questions** | How many people are exposed to louder than 75 dB? / What does 75 dB compare to? |
| **Common sound** | Busy street / city traffic (roadside snapshot) · **75–90 dB** |
| **Map** | Fly to Cologne; road · Lden; highlight `Germany\|Cologne` |

Runner-up >75 road: Munich 11.5k, Düsseldorf 9.6k.

---

## Step 3 — Paris

| | |
| --- | --- |
| **Year** | **2025** |
| **Metric** | Measured **Ln** (Bruitparif road sites) |
| **Loudest site** | **Périphérique Vincennes** |
| **Max dB** | **77.5 dB Ln** |
| **Common sound** | Busy street / city traffic · **75–90 dB** |
| **Question angle** | Which site had the highest night level in 2025? What everyday sound sits near that? |

---

## Step 4 — Madrid

| | |
| --- | --- |
| **Year** | **2026** (most recent year present in SIVCA nightly extract) |
| **Metric** | Night **LAeq** (Periodo N), focus stations |
| **Loudest focus station** | **ID 6** |
| **Max dB** | Median **64.4 dB**; peak reading **80.4 dB** (same station) |
| **Common sound (median)** | Normal conversation · **60–65 dB** |
| **Question angle** | Which focus station is loudest at night in 2026? What does that LAeq feel like? |

---

## Step 5 — Hong Kong

| | |
| --- | --- |
| **Year** | **2020** |
| **Metric** | Traffic **L₁₀ (1 h @ 4 m)** raster |
| **Max L₁₀** | **~96.8 dB** |
| **Common sound** | Personal music (headphones; high volume) · **96–110 dB** |
| **Very loud extent** | **~23.0%** of valid cells **>70 dB** → **~96.9 km²** |
| **Method** | Valid cells = finite L₁₀ ∈ [30, 100]; count L₁₀>70; each cell **10×10 m** → area. **Not** road-km (no centreline). |

---

## Step 6 — Seoul

| | |
| --- | --- |
| **Year** | **2024** |
| **Metric** | Daily road **Leq** (Seoul-only) |
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
