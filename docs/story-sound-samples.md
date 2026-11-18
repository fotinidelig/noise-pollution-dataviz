# Story sound samples (downloaded)

Local CC0 / public-domain / CC-licensed clips for Fotini’s dB-focused scrolly viz. Files live in the app repo under `app/public/audio/` and are wired into the **Sounds** story step (`SoundScale`).

**Playback caveat:** browser volume ≠ calibrated SPL. Use clips for *timbre / character*; pair with the labeled dB anchors below (from [`common-sounds-db-levels.md`](./common-sounds-db-levels.md) / NIH everyday-sounds table). Never claim the clip “is” that dB on the user’s device.

**Peak levels:** all six story MP3s are peak-normalized to ≈ **−1 dBFS** max amplitude (same peak; not LUFS loudness-matched).

**Companion resource list:** [`sound-samples-and-perception.md`](./sound-samples-and-perception.md).

---

## Inventory

| Story label | Local path | Approx. duration | License | Source URL | Suggested story dB anchor |
| --- | --- | --- | --- | --- | --- |
| Birds singing | `app/public/audio/birds-singing.mp3` | ~3.5 s | **US public domain** — credit National Park Service | [NPS American Robin](https://www.nps.gov/subjects/sound/sounds-american-robin.htm) · MP3: `nri-AmericanRobinYELL.mp3` | **~44–60 dB** bird calls / song at listening distance (calm park ambient); not 1 m source levels |
| Water stream | `app/public/audio/water-stream.mp3` | ~5.1 s | **US public domain** — credit National Park Service | [NPS Stream](https://www.nps.gov/subjects/sound/sounds-stream.htm) · MP3: `nri-StreamMUWO.mp3` (Muir Woods / Golden Gate NRA) | **~40–50 dB** quiet creek / stream ambient (nature calm band) |
| Motorcycle passing | `app/public/audio/motorcycle-passing.mp3` | ~4.0 s | **US public domain** — credit National Park Service | [NPS Motorcycle](https://www.nps.gov/subjects/sound/sounds-motorcycle.htm) · MP3: `nri-MotorcycleMORA.mp3` (Mount Rainier NP) | **~90 dB** passing motorcycle (NIH); CDC band **80–110 dB** |
| Helicopter | `app/public/audio/helicopter.mp3` | ~4.2 s | **US public domain** — credit National Park Service | [NPS Helicopter](https://www.nps.gov/subjects/sound/sounds-helicopter.htm) · MP3: `nri-HelicopterYOSE.mp3` (Yosemite NP) | **~105 dB** helicopter (NIH); distance-critical |
| Rock concert | `app/public/audio/rock-concert.mp3` | ~9.1 s | **CC0 1.0** (Creative Commons Zero) — attribution optional | [Freesound — Rock Concert Crowd 1 (Filmscore)](https://freesound.org/people/Filmscore/sounds/823091/) · HQ preview MP3 used | **~90–130 dB** amplified rock concert (NIH); CDC concerts often **95–115 dB**. Clip is **crowd roar**, not PA music — still the loud-venue character |
| Vacuum cleaner | `app/public/audio/vacuum-cleaner.mp3` | ~8–19 s (source length) | **CC-licensed via Freesound** — credit **freesound_community** / original uploader | [Freesound — Vacuum cleaner noise (`freesound_community-vacuum-cleaner-76618`, id **76618**)](https://freesound.org/people/freesound_community/sounds/76618/) | **~70 dB** vacuum cleaner (NIH / project household anchor) |

Gallery index (birds, stream, machines): [NPS Natural Sounds Sound Gallery](https://www.nps.gov/subjects/sound/gallery.htm) — files are public domain; please give appropriate credit.

**Replaced:** earlier vacuum clip was Freesound Sadiquecat #817676 (CC0 Philips PowerPro); swapped to **#76618** per Fotini (2026-11-18).

---

## Format notes

| File | Format (as shipped) | Notes |
| --- | --- | --- |
| `birds-singing.mp3` | MP3 (lame) · peak ≈ −1 dBFS | Peak-normalized |
| `water-stream.mp3` | MP3 (lame) · peak ≈ −1 dBFS | Peak-normalized |
| `motorcycle-passing.mp3` | MP3 (lame) · peak ≈ −1 dBFS | Peak-normalized |
| `helicopter.mp3` | MP3 (lame) · peak ≈ −1 dBFS | Peak-normalized |
| `rock-concert.mp3` | MP3 (lame) · peak ≈ −1 dBFS | Peak-normalized |
| `vacuum-cleaner.mp3` | MP3 (lame) · peak ≈ −1 dBFS | From Freesound **76618**; peak-normalized |

---

## Suggested scrolly ladder (loudness doubling)

Approximate **+10 dB ≈ twice as loud** (NIDCD rule of thumb) using these anchors:

1. Stream / birds (~**40–60 dB**) — calm nature floor  
2. Vacuum (~**70 dB**) — household middle; +10–30 dB vs calm  
3. Motorcycle pass (~**90 dB**) — ~4× as loud as vacuum  
4. Helicopter (~**105 dB**) — another ~2–3× step above motorcycle  
5. Rock concert (~**90–130 dB**) — top intense band; venue-dependent  

Story UI order (quiet→loud, equally spaced): water → birds → vacuum → motorcycle → helicopter → rock concert.

---

## Done

- React / scrolly wiring: `SoundScale` on the **Sounds** beat (2nd step, after intro)  
- Click-to-play samples  
- Peak-normalize shared max amplitude  
- Vacuum swapped to Freesound **76618**
