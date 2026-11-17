# Europe noise viz — active resources

Mirrored from the Project Agent Store for offline/repo use. Canonical curated list also lives under `/cursor/stores/self/docs/europe-noise-active-resources.md`.

**Sprint scope:** Europe transport noise exposure + health burden (EEA END 2022 + WHO thresholds + EEA 2025) + perception (SILC) + computed HA/HSD.  
**Not in this stack:** Asia wellbeing brief (kept separately). **Deferred (not Europe core):** US NPS existing vs natural L50 rasters.

---

## Core stack

| Resource | What it gives this sprint | Link / path |
| --- | --- | --- |
| **EEA END 2022 — exposure tables** | People exposed by 5 dB bands; Lden / Lnight; by source; agglomerations. | [DataHub END exposure](https://www.eea.europa.eu/en/datahub/datahubitem-view/c952f520-8d71-42c9-b74c-b7eb002f939b) |
| **EEA END 2022 — noise contours** | Vector Lden/Lnight contours by source. | [SDI contours 2022](https://sdi.eea.europa.eu/catalogue/datahub/api/records/853e72e4-4642-47d1-8556-2cc231bd43e0) |
| **EEA *Environmental noise in Europe 2025*** | Headline Europe burden (use post-corrigendum). | [EEA publication](https://www.eea.europa.eu/en/analysis/publications/environmental-noise-in-europe-2025) |
| **WHO ENG 2018** | Guideline floors + ERFs (annoyance, sleep, …). | [WHO Europe ENG](https://www.who.int/europe/publications/i/item/9789289053563) |
| **EEA HA/HSD indicator** | Official modelled HA / HSD from END × WHO ERFs. | [Health impacts of exposure to noise](https://www.eea.europa.eu/en/analysis/indicators/health-impacts-of-exposure-to-1) |
| **Eurostat SILC `ilc_mddw01`** | Country % reporting noise from neighbours or street (2023) + Annex 5 household *n*. | [Data Browser](https://ec.europa.eu/eurostat/databrowser/view/ilc_mddw01/default/table?lang=en); [`../data/processed/eurostat/ilc_mddw01_2023_noise_with_sample_size.csv`](../data/processed/eurostat/ilc_mddw01_2023_noise_with_sample_size.csv); Annex 5: [`../data/raw/eurostat/ilc_sieusilc_an_Annex_5-SampSize_rotat_nonresp.pdf`](../data/raw/eurostat/ilc_sieusilc_an_Annex_5-SampSize_rotat_nonresp.pdf) |

---

## WHO HA / HSD — how we count people

Polynomials from WHO ENG 2018 / Guski et al. (annoyance) / Basner & McGuire (sleep). For each agglomeration × source:

`people_HA = Σ (people_in_Lden_band × %HA(midpoint) / 100)`  
`people_HSD = Σ (people_in_Lnight_band × %HSD(midpoint) / 100)`

Industry skipped (no WHO %HA/%HSD ERF). Total END exposed people (no ≥18 filter in the table).

**Repo outputs:**

- [`../data/processed/eea-end/exposure_agglomeration_who_ha_hsd.csv`](../data/processed/eea-end/exposure_agglomeration_who_ha_hsd.csv)
- [`../data/processed/eea-end/exposure_agglomeration_who_ha_hsd_by_band.csv`](../data/processed/eea-end/exposure_agglomeration_who_ha_hsd_by_band.csv)
- [`../data/processed/eea-end/exposure_agglomeration_who_ha_hsd_README.md`](../data/processed/eea-end/exposure_agglomeration_who_ha_hsd_README.md)
- Script: [`../analysis/scripts/compute_who_ha_hsd.py`](../analysis/scripts/compute_who_ha_hsd.py)

---

## Eurostat SILC perception layer

- Metric: % reporting noise from neighbours or street (`ilc_mddw01`, TOTAL × TOTAL, PC), year **2023**.
- Sample size: Annex 5 Table 2 — *Achieved Sample Size Households 2023* (AL / ME / MK have % but no *n*).
- Extract: [`../data/processed/eurostat/ilc_mddw01_2023_noise_with_sample_size.csv`](../data/processed/eurostat/ilc_mddw01_2023_noise_with_sample_size.csv)
