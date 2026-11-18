# Common sound levels for END map storytelling

Reference table for comparing **everyday sound pressure levels** with **European Environmental Noise Directive (END)** maps, which report long-term outdoor indicators **Lden** and **Lnight** at the most exposed dwelling façade.

**Data file:** [`common-sounds-db-levels.csv`](./common-sounds-db-levels.csv) — **29 rows**, calm → intense.

---

## Comparability caveat (read before pairing with Lden/Lnight)

| Concept | END map layers (Lden / Lnight) | Typical “common sound” figures in this CSV |
| --- | --- | --- |
| **What it averages** | **A-weighted energy** over **a year** (Lden: day + 5 dB evening + 10 dB night penalties) or **night only** (Lnight) | Often **seconds to minutes** (SPL, LAeq over short intervals, or **Lmax** for single events) |
| **Where measured** | **Outdoors**, most exposed façade | Mix of indoor/outdoor; many charts omit exact geometry |
| **Events vs background** | Integrates **all** traffic/aircraft/rail passages in the year | May describe **one** horn, **one** flyover, or **one** concert |
| **Apples-to-apples?** | Compare **calm rural Lden ~30–35 dB** to quiet façades; compare **busy road Lden 55–65+** to sustained traffic—not to a **120 dB** horn peak | Use common sounds as **perceptual anchors**, not as direct readings off the map legend |

**WHO outdoor guidelines (for map thresholds, not “sounds”):** road **&lt;53 dB Lden** / **&lt;45 dB Lnight**; aircraft **&lt;45 dB Lden** / **&lt;40 dB Lnight** ([WHO ENG 2018](https://www.who.int/europe/publications/i/item/9789289053563)).

**Quiet baseline in Europe:** wilderness / sparsely populated areas often **Lden 30–35 dB** with instantaneous levels mostly **below ~30 dB(A)** ([EASA background noise report](https://www.easa.europa.eu/sites/default/files/dfu/Background_noise_report.pdf)).

---

## Source hierarchy used

1. **WHO** environmental / community noise guidance  
2. **NIOSH/CDC** curated decibel tables and hearing-health infographics  
3. **EPA** noise education charts (legacy federal reference; distances noted)  
4. **Peer-reviewed measurements** (forest, rain, aircraft cabin, field birdsong studies)  
5. **EASA/SINTEF** European background-noise synthesis  
6. **Environmental impact / noise manuals** for aircraft Lmax at altitude (cited; not preferred over peer review for cabins)

Blog-only numbers were avoided where agency or journal sources exist.

---

## Conflicts reconciled

| Sound | Spread in literature | Resolution in CSV |
| --- | --- | --- |
| Whisper | 25 dB (NIH) vs 30 dB (CDC card) | **25–30 dB** range; both cited |
| Street traffic | 75 dB busy (NIH) vs ~90 dB city traffic at 50 ft (EPA) | **75–90 dB**; distance/context in notes |
| Rock concert | 90–130 dB (NIH) vs 95–115 dB (CDC) | **90–130 dB**; wider authoritative NIH span |
| Aircraft cabin cruise | ~69–73 dB(A) wide-body cruise vs fleet median **83.5 dB(A)** | **72–83 dB(A)** LAeq; study-dependent |
| Jet takeoff | 118 dB at 200 ft vs up to **150 dB** at 25 m | **118–140 dB**; distance-critical |

---

## Story highlights (vs typical European façade Lden/Lnight)

1. **Quiet rural night (~25–30 dB instantaneous)** sits near the **floor of many calm-area Lden values (~30–35 dB)** — useful “what silence sounds like” next to green/low-Lden pixels.  
2. **Normal conversation (60–65 dB)** is far **above** WHO bedroom guidance (**30 dB LAeq night**) but can occur **indoors** while the map shows **outdoor façade** exposure (often **10–25 dB** lower indoors with closed windows per WHO).  
3. **Busy roadside snapshot (75–90 dB)** illustrates a **single moment** on a loud street; END **Lden** for major roads is often **55–65+ dB** at façades — sustained but **not** as high as peak pass-by SPL.  
4. **WHO road guideline (53 dB Lden)** is in the same ballpark as **quiet home/office (~50 dB)** snapshots — a deliberate map story: “WHO’s road limit feels like living inside a quiet room, outdoors at the façade.”  
5. **Jet flyover Lmax (~100 dB at ~1000 ft)** vs **aircraft Lden guideline (45 dB)** — one flyover is a **brief spike**; the map’s **45 dB Lden** is the **year-long aircraft energy average** at home.

---

## Column guide (`common-sounds-db-levels.csv`)

| Column | Meaning |
| --- | --- |
| `sound_name` | Plain-language label for viz copy |
| `category` | `calm` \| `everyday` \| `intense` |
| `sort_order` | Ascending loudness for chart joins |
| `db_min`, `db_max` | dB range (equal if point estimate) |
| `metric` | SPL, LAeq, Lmax, etc. |
| `distance_context` | Geometry when known |
| `measurement_notes` | Metric mismatch warnings, study caveats |
| `source_title`, `source_url` | Pipe-separated if multiple |

---



## Birdsong / dawn chorus (distance matters)

| Anchor | Approx. level | What it is | Sources |
| --- | --- | --- | --- |
| Distant bird calls / bird song (listening distance) | **44–60 dB** | Comparison-chart levels at garden/park distance | [Purdue noise comparisons](https://www.physics.purdue.edu/primelab/safety/PPE/Hearing%20protection/dblevels.htm) (~44 dB bird calls); NOAA hearing chart (~60 dB bird song with conversation) |
| Dawn-chorus ambient (temperate) | **~45–55 dB(A)** | Outdoor ambient while chorus is active; not a 1 m beak reading | [Airport-closure dawn chorus study](https://pmc.ncbi.nlm.nih.gov/articles/PMC9470256/) (~46.2 dB(A) temperate forest ambient); [Bear River POMA](https://pubs.aip.org/asa/poma/article-pdf/doi/10.1121/2.0001873/19875147/010001_1_2.0001873.pdf) (large day-to-day chorus SPL swings); dense urban choruses can be higher ([myna dawn ~68.8 dBA](https://pubs.aip.org/asa/jasa/article/154/4_supplement/A230/2924383/Urban-Soundscape-White-vented-Myna-choruses-on)) |
| Soft song (song sparrow @ 1 m) | **55–77 dB SPL** | Close-range calibrated mic | [Anderson et al. 2008](http://www.nowickilab.org/papers/ASPN08e.pdf) |
| Territorial / broadcast song (@ 1 m) | **~74–100 dB** (song thrush peak ~**103**) | Source level beside the bird | Brackenbury 1979 via [Loning et al. 2022](https://pmc.ncbi.nlm.nih.gov/articles/PMC8902932/); [Jakobsen et al. 2021](https://www.frontiersin.org/journals/ecology-and-evolution/articles/10.3389/fevo.2021.657254/full) |

**Storying tip:** wilderness monitors at **~15–25 dB** sit **well below** distant bird-call charts — birds remain audible. City-park hours near **~49 dB** already overlap dawn-chorus ambient bands. Do **not** equate 1 m song peaks with END **Lden** façades.

*Compiled for the data-viz workshop Europe END stack; see also [`europe-noise-active-resources.md`](./europe-noise-active-resources.md) and [`calm-quiet-place-levels.md`](./calm-quiet-place-levels.md).*