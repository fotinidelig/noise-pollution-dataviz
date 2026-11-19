# Story sound samples (downloaded)

Local CC0 / public-domain / CC-licensed clips for Fotini’s dB-focused scrolly viz. Files live under `app/public/audio/` and are wired into the **Sounds** story step (`SoundScale` + `SoundGrainOverlay`).

**Playback caveat:** browser volume ≠ calibrated SPL. Use clips for *timbre / character*; pair with the labeled dB anchors below. Never claim the clip “is” that dB on the user’s device.

**Peak levels:** story MP3s are peak-normalized to ≈ **−1 dBFS** max amplitude (same peak; not LUFS loudness-matched).

**While playing:** full-screen **visible particle** grain overlays the map (dimmed underneath). Particle count scales with loudness ratio **2^((dB − 45)/10)** (2× density per +10 dB); dim uses a soft ceiling of the same ratio. Only the playing column’s pulse rings animate.

---

## Inventory (wired quiet → loud)

| Story label | Local path | Approx. duration | License | Source URL | Suggested story dB anchor |
| --- | --- | --- | --- | --- | --- |
| Water stream | `app/public/audio/water-stream.mp3` | ~5.1 s | **US public domain** — credit National Park Service | [NPS Stream](https://www.nps.gov/subjects/sound/sounds-stream.htm) | **~40–50 dB** |
| Birds singing | `app/public/audio/birds-singing.mp3` | ~3.5 s | **US public domain** — credit National Park Service | [NPS American Robin](https://www.nps.gov/subjects/sound/sounds-american-robin.htm) | **~44–60 dB** |
| Vacuum cleaner | `app/public/audio/vacuum-cleaner.mp3` | ~22 s | **CC-licensed via Freesound** — credit **freesound_community** | [Freesound id **76618**](https://freesound.org/people/freesound_community/sounds/76618/) | **~70 dB** |
| Blender | `app/public/audio/blender.mp3` | (source length) | **CC-licensed via Freesound** — credit **freesound_community** | [Freesound `freesound_community-blender-72304`, id **72304**](https://freesound.org/people/freesound_community/sounds/72304/) | **~80–90 dB** |
| Motorcycle | `app/public/audio/freesound_community-motorcycle-77112.mp3` | ~21 s | **CC-licensed via Freesound** — credit **freesound_community** | [Freesound `freesound_community-motorcycle-77112`, id **77112**](https://freesound.org/people/freesound_community/sounds/77112/) | **~90 dB** (loud end of the line) |

Gallery index (birds, stream, machines): [NPS Natural Sounds Sound Gallery](https://www.nps.gov/subjects/sound/gallery.htm).

### Removed from the story line

| Former | Notes |
| --- | --- |
| Rock concert (`rock-concert.mp3`, Filmscore #823091 CC0) | Replaced by blender; removed from UI and repo audio folder |
| Helicopter (`helicopter.mp3`, NPS PD) | Dropped so the quiet→loud line ends near **~90 dB** |

### Vacuum history

Earlier vacuum clip was Freesound Sadiquecat #817676 (CC0); swapped to **#76618** per Fotini (2026-11-18).

### Motorcycle history

Earlier motorcycle clip was NPS PD (`motorcycle-passing.mp3`); swapped to Freesound **#77112** (`freesound_community-motorcycle-77112`) per Fotini (2026-11-19).

---

## Suggested scrolly ladder

1. Stream / birds (~**40–60 dB**) — calm nature floor / `dB_ref` ≈ 45 for grain  
2. Vacuum (~**70 dB**) — household middle; HSD threshold highlight  
3. Blender (~**80–90 dB**) — loud household  
4. Motorcycle (~**90 dB**) — loud end of the compare line  

UI order (quiet→loud, equally spaced): water → birds → vacuum → blender → motorcycle.
