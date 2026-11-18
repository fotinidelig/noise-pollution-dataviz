# Calm / quiet places — measured & regulatory levels

Companion to [`common-sounds-db-levels.md`](./common-sounds-db-levels.md) for Fotini’s noise-pollution scrollytelling: **quiet anchors** to contrast with loud cities.

**Data file:** [`calm-quiet-place-levels.csv`](./calm-quiet-place-levels.csv) — **22 place rows** (research inventory).

**App map/chart (`app/public/data/calm_spaces.json`):** **12 measured sites** only — EASA-cited park hours (Norra Djurgården, Tiergarten, Trondheim), Stockholm JASA sites, Silent Route, NPS Type-1 monitors (Denali, GRCA031, Haleakalā Nuʻu, Olympic Hoh + Hurricane Ridge existing & natural). **Excluded from the viz:** unnamed JASA quiet-forest demo (no public locality), END/policy thresholds (Dublin, Vienna, Italy…), EEA QSI modelled quiet, synthesis floors, interpretive-only crater/trail citations without instrumented companions.

---

## 1. Comparability caveat (read first)

| Concept | Instantaneous SPL / short LAeq / L50 / L90 | END **Lden** / **Lnight** |
| --- | --- | --- |
| **What it averages** | Seconds to days (or a percentile of 1‑s samples) | Year-long A‑weighted energy; Lden adds **+5 dB** evening and **+10 dB** night penalties |
| **What “quiet” means** | How it *sounds right now* (or the median hour) | Long-term façade / map indicator for policy |
| **Typical quiet nature** | Instantaneous often **~25–35 dB(A)**; parks L50/LAeq **~15–40** if no river | Wilderness / sparse areas often **Lden ~30–35 dB** floor ([EASA/SINTEF](https://www.easa.europa.eu/sites/default/files/dfu/Background_noise_report.pdf)) |
| **Urban “quiet area”** | City parks often **~45–55 LAeq** short-term | END Member States often use **Lden ≤50–55** as a *screening* threshold — still louder than wilderness |
| **Apples-to-apples?** | Use place rows as **perceptual / “how it sounds”** anchors next to vacuum (~70 dB) / blender (~80–90 dB) | Do **not** equate a 15‑min LAeq to a map Lden pixel without saying so |

**WHO context (not place measurements):** indoor bedroom **30 dB LAeq,8h**; outdoor living areas **50 / 55 dB LAeq** for moderate / serious annoyance ([WHO Community Noise 1999](https://www.who.int/publications/i/item/a68672)). Preserve large quiet outdoor areas (no single dB for parks).

---

## 2. Place table

| Place | Country | Setting | Metric | dB value | Year | Context | Link |
| --- | --- | --- | --- | --- | --- | --- | --- |
| European wilderness / sparsely populated areas (synthesis) | Europe (multi-country) | wilderness | Lden (typical floor); instantaneous LA | Lden **30–35**; instantaneous mostly **&lt;30** (seldom below **25–30**) | 2008 | EASA/SINTEF synthesis: wind-dominated natural background; Lden rarely drops below ~30–35 even far from roads. | [EASA PDF](https://www.easa.europa.eu/sites/default/files/dfu/Background_noise_report.pdf) |
| Irish Quiet Areas — proposed open-country criterion | Ireland | nature | LA10,1h | Day **≤30**; night **≤27** | 2003 | EPA ERTDI campaign (15 large rural sites, ~21k intervals): recommend **LA90/LA10** over Lden to describe quietness. | [EPA synthesis PDF](https://www.epa.ie/publications/research/reports/EPA_noise_in_quiet_areas_ERTDI17_synthesis.pdf) |
| Silent Route (Wdecki Landscape Park, Tuchola Forest) | Poland | nature / park trail | LAeq (route means) | **~31.5** (Nov 2022); **~34.7** (Jun 2023); points **~30–48** | 2022–2023 | Peer-reviewed case study of Poland’s first “Silent Route”; natural forest soundscape; occasional tourist/road spikes. | [UKW journal PDF](https://czasopisma.ukw.edu.pl/index.php/gat/article/download/3033/3224/6181) |
| Norra Djurgården (park), Stockholm | Sweden | city park | LAeq,24h; LA95 | **46**; LA95 **39** | ~2000s (cited 2008) | Classic European *urban quiet pocket* in EASA background-noise compilation — quieter than busy façades, not wilderness. | [EASA PDF](https://www.easa.europa.eu/sites/default/files/dfu/Background_noise_report.pdf) |
| Tiergarten, Berlin | Germany | city park | LAeq,1h; LA90 | **49**; LA90 **47.4** | ~2000s (cited 2008) | Midday hour in a large inner-city park; background dominated by distant traffic. | [EASA PDF](https://www.easa.europa.eu/sites/default/files/dfu/Background_noise_report.pdf) |
| City park, Trondheim | Norway | city park | LAeq,1h; LA90 | **49.3**; LA90 **46.9** | ~2000s (cited 2008) | Same EASA compilation: Nordic city-park daytime hour. | [EASA PDF](https://www.easa.europa.eu/sites/default/files/dfu/Background_noise_report.pdf) |
| Stockholm suburban green areas (e.g. Tyresta / Flaten-type sites) | Sweden | nature / suburban green | LAeq,15min | **42–50** | 2004–2006 | Nilsson & Berglund JASA soundscape study: nature sounds dominate; **84–100%** of visitors rated soundscape good/very good. | [JASA abstract](https://doi.org/10.1121/1.4777308) · [INTER-NOISE PDF](https://www.ingentaconnect.com/contentone/ince/incecp/2007/00002007/00000006/art00015) |
| Stockholm city parks (study set) | Sweden | city park | LAeq,15min | **49–60** | 2004–2006 | Same campaign: traffic audible; only **52–65%** “good/very good”; authors argue **&lt;50 dBA** needed for restorative urban outdoor soundscapes. | [JASA abstract](https://doi.org/10.1121/1.4777308) |
| Shielded European inner-city courtyards / back yards (synthesis) | Europe (multi) | city (quiet pocket) | LAeq (typical) | **45–50** | 2008 | EASA: typical shielded urban locations away from street façades. | [EASA PDF](https://www.easa.europa.eu/sites/default/files/dfu/Background_noise_report.pdf) |
| Vienna designated quiet areas (threshold) | Austria | city / protected | Lden; Lnight | **≤50**; **≤40** (excl. air traffic) | ~2010s | Wiener Umgebungslärmschutzverordnung definition for END quiet areas (e.g. parks / protected landscapes in agglomeration). | [END evaluation country fiches PDF](https://www.laerminfo.at/dam/jcr:6066f598-ed39-4d76-b215-d56fa5257e6b/country_fiches_study_evaluation_directive_environmental_noise.pdf) |
| Italy — quiet areas in agglomerations (national criterion) | Italy | city | Lden | **≤55** | 2022 | MASE decree implementing END: preliminary acoustic filter for public quiet zones in cities. | [Forum Acusticum 2023](https://doi.org/10.61782/fa.2023.0027) |
| Italy — quiet areas in open country (preliminary) | Italy | nature / village hinterland | Lden | **≤50** (target via setbacks) | 2022 | Same decree: open-country candidates aimed at Lden not exceeding ~50 via distance from transport/industry. | [Forum Acusticum 2023](https://doi.org/10.61782/fa.2023.0027) |
| Dublin City designated Quiet Areas (e.g. St. Anne’s Park, Blessington Basin, Ranelagh Gardens) | Ireland | city park | Lden (map criterion) | **≤55** (absolute); often **≥10–15 dB** quieter than surroundings (relative) | 2011 maps → designation | Official END Quiet Areas: parks with pathways, public access, strategic road maps ≤55 Lden. | [Dublin City Council](https://www.dublincity.ie/environment-and-climate-action/controlling-noise-pollution/quiet-areas-dublin-city) · [nomination PDF](https://www.dublincity.ie/sites/default/files/media/file-uploads/2018-07/QuietAreas_WebDoc.pdf) |
| Sweden Class A remote recreational / mountain–forest benchmark | Sweden | wilderness | Instantaneous dB(A) (benchmark) | **~25** | Guidance cited 2019 | Highest quietness class in Swedish municipal quiet-area practice (remote mountains, forests, national parks). | [IJERPH 2019](https://doi.org/10.3390/ijerph16010134) |
| Haleakalā crater, Haleakalā NP | USA (Hawaiʻi) | wilderness | dBA (NPS interpretive table / cited ambient) | **~10** | Cited in NPS materials (Bell et al. 2009 lineage) | Among quietest NPS-cited natural levels — near breathing; later Nuʻu unit monitors are higher (~22–24 L50). | [NPS acoustic resource brief](https://irma.nps.gov/DataStore/FileSource/Get/2226001?filename=NSNSD_Acoustic_CARL.pdf) |
| Haleakalā NP — Nuʻu unit (HALE004) | USA (Hawaiʻi) | wilderness | L50 (existing); Lnat | Day **23.5** / night **22.3**; Lnat ~**21–22** | 2013 | Type‑1 continuous monitoring (~58 days); birds + distant aircraft. | [NSNSD / CSU report PDF](https://sites.warnercnr.colostate.edu/soundandlightecologyteam/wp-content/uploads/sites/146/2020/11/haleakala.pdf) |
| Grand Canyon NP — remote trails (interpretive) | USA | wilderness | dBA (cited ambient) | **~20** | Cited NPS (Bell et al. 2009) | “Softer than a whisper” on some remote trails — storytelling contrast to city traffic. | [NPS acoustic resource brief](https://irma.nps.gov/DataStore/FileSource/Get/2226001?filename=NSNSD_Acoustic_CARL.pdf) |
| Grand Canyon NP — GRCA031 (backcountry) | USA | wilderness | LA50 (existing) | Summer day **38.9** / night **21.8**; fall day **30.6** / night **15.3** | 2017 | Multi-week Type‑1 monitoring; night fall median among quietest backcountry desert readings. | [NPS NRR 2020/2070 PDF](https://www.npshistory.com/publications/grca/nrr-2020-2070.pdf) |
| Denali NP — Birch Creek | USA | wilderness | L50 (existing); Lnat | **17.7**; Lnat **17.6** | 2013 | Very quiet inland site; aircraft rare vs road corridor sites. | [NPS DENA NRDS 2015/989](https://parkplanning.nps.gov/showFile.cfm?projectID=94730&sfid=424997) |
| Olympic NP — Hoh River Trail (OLYM001) | USA | wilderness (river forest) | L50 (existing ambient) | Overall **~38**; day/night also ~**38** / **~34** | 2010 (winter) | River runoff raises median; still **~83%** natural sounds audible; not “silent,” but wild. | [NPS IRMA DownloadFile/560226](https://irma.nps.gov/DataStore/DownloadFile/560226) |
| Olympic NP — Hurricane Ridge (OLYM003) | USA | wilderness / alpine | L50 natural ambient (day) | **~15.4** (natural); existing day L50 **~24.4** | 2010 (winter) | Road closed during campaign → unusually low anthropogenic contribution. | [NPS IRMA DownloadFile/560226](https://irma.nps.gov/DataStore/DownloadFile/560226) |
| Quiet forest (lab/field JASA demonstration) | (study forest; not named locality) | nature | LAeq,60s | **28.7** | 2013 | Peer-reviewed demonstration of very quiet forest mid-band SPLs (often &lt;20 dB mid frequencies). **Not on the app map** (unnamed locality). | [JASA](https://doi.org/10.1121/1.4799667) |

**Also useful (not a single place):** EEA Report 14/2016 maps **potential** rural quiet areas (~**18%** of Europe “quiet”; Nordic countries highest share) — model/proxy, not site LAeq. [EEA publication](https://www.eea.europa.eu/en/analysis/publications/quiet-areas-in-europe).

---

## 3. Best 5–8 for storytelling (“how it sounds” vs vacuum / blender)

Pair with [`common-sounds-db-levels.csv`](./common-sounds-db-levels.csv): whisper **25–30**, distant bird calls **44–60**, dawn-chorus ambient **~45–55**, conversation **60–65**, vacuum **~70**, blender **~80–90**, busy street snapshot **75–90**.
## Birdsong vs calm sites (Nov 2026)

For perceptual anchors next to measured calm places, use [`common-sounds-db-levels.md`](./common-sounds-db-levels.md) **Birdsong / dawn chorus**:

- Distant bird calls / song (charts): **44–60 dB** — [Purdue](https://www.physics.purdue.edu/primelab/safety/PPE/Hearing%20protection/dblevels.htm), NOAA chart lineage.
- Temperate dawn-chorus ambient: **~45–55 dB(A)** — [Tegel airport natural experiment](https://pmc.ncbi.nlm.nih.gov/articles/PMC9470256/) (~46.2 dB(A) forest ambient); [Bear River dawn chorus](https://pubs.aip.org/asa/poma/article-pdf/doi/10.1121/2.0001873/19875147/010001_1_2.0001873.pdf).
- Territorial song at **1 m**: **~74–100 dB** SPL — [Loning et al. 2022](https://pmc.ncbi.nlm.nih.gov/articles/PMC8902932/) citing Brackenbury; soft song sparrow **55–77** — [Anderson et al. 2008](http://www.nowickilab.org/papers/ASPN08e.pdf).

Wilderness L50/LA50 values in this doc (**~15–25 dB**) sit below distant-bird charts (headroom to *hear* birds). City-park hours (**~46–49 dB**) already sit in dawn-chorus ambient territory.



1. **Haleakalā crater ~10 dBA** — near **breathing**; ~60 dB below vacuum → “city noise is sixty times louder on a log scale” story (energy: 10⁶×). Prefer as *extreme floor*; note Nuʻu measured L50 is ~22–24.
2. **Denali Birch Creek L50 ~18 dBA** — multi-week NPS monitor; still far below whisper upper end; good “continental wilderness” beat.
3. **Grand Canyon fall night LA50 ~15 dBA (GRCA031)** — measured desert night; contrast with **GRCA summer day ~39**.
4. **European wilderness Lden ~30–35 / instantaneous &lt;30** — the END-map-compatible rural floor next to green low-Lden pixels ([EASA](https://www.easa.europa.eu/sites/default/files/dfu/Background_noise_report.pdf)).
5. **Silent Route ~31–35 LAeq** — walkable European forest trail people can *imagine visiting*; still ~35–40 dB quieter than a vacuum.
6. **Stockholm suburban green 42–50 LAeq,15min** — restorative “near-city nature”; about as loud as a quiet home, **well below** conversation at 1 m.
7. **Norra Djurgården / Tiergarten / Trondheim parks ~46–49 LAeq** — honest **city quiet pockets**: calm relative to streets, not silent; still ~20 dB below vacuum.
8. **Dublin / Italian / Vienna END quiet-area thresholds (Lden 50–55)** — policy “quiet” that can still feel like a soft outdoor living area (WHO 50–55 outdoor annoyance band) — perfect for explaining why **END quiet ≠ wilderness silence**.

---

## 4. Explicit exclusions (untrustworthy or unfit)

| Excluded | Why |
| --- | --- |
| Blog / listicle “quietest places in Europe/world” without methods | No metric, year, or instrument chain |
| Crowd-sourced “calm maps” / app rankings (e.g. citizen calm scores without calibration) | Not SPL/Lden; not peer-reviewed or agency |
| Unsourced “quietest city” league tables | Often mix Lden, surveys, and marketing |
| AuKLM-style derived “calm Paris” overlays | Automated remix of Bruitparif contours + OSM — estimate, not park measurements |
| Sonitus vendor insight posts (e.g. People’s Park) | Useful hint only; prefer local-authority NAP / EPA docs for designation |
| Nivolet Pass (Gran Paradiso) summer LAeq **~50–61** | Peer-reviewed but **fails** proposed quiet-area day/night limits — tourist alpine road, not a calm exemplar |
| Treating END **Lden ≤55** parks as “silent” | Still in WHO outdoor-annoyance range; metric ≠ instantaneous nature quiet |
| Equating NPS **L50** to END **Lden** without conversion | Different definitions and averaging |
| Haleakalā “quietest on Earth” popular-science retellings alone | Use NPS brief / monitoring reports; crater ~10 is interpretive, Nuʻu L50 ~22–24 is the instrumented companion |

---

## Source hierarchy used

1. **EASA/SINTEF** European background-noise synthesis  
2. **EEA** quiet-areas mapping (potential rural quiet)  
3. **National EPAs / city END Quiet Area docs** (Ireland EPA, Dublin City, Austria/Italy criteria)  
4. **Peer-reviewed** soundscape / quiet-trail studies (JASA, IJERPH, Forum Acusticum, Polish journal)  
5. **NPS Natural Sounds** acoustic monitoring reports (Type‑1 SLM, multi-week)  
6. **WHO** guideline values for storytelling anchors only  

*Compiled for the data-viz workshop Europe END / scrolly stack; see also [`common-sounds-db-levels.md`](./common-sounds-db-levels.md) and [`europe-noise-active-resources.md`](./europe-noise-active-resources.md).*
