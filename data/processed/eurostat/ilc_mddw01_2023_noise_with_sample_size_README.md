# SILC `ilc_mddw01` 2023 extract

**File:** [`ilc_mddw01_2023_noise_with_sample_size.csv`](./ilc_mddw01_2023_noise_with_sample_size.csv)

| Column | Meaning |
| --- | --- |
| `geo` | Eurostat geo code |
| `country` | Country / aggregate label |
| `year` | 2023 |
| `percent_noise_neighbours_or_street` | % of people reporting noise from neighbours or street (TOTAL × TOTAL) |
| `value_flag` | Eurostat flag if any (e.g. `u` unreliable) |
| `achieved_sample_size_households_2023` | Annex 5 Table 2 achieved household sample size |
| `sample_size_source` | Citation when sample size joined |

**Sources:** [ilc_mddw01](https://ec.europa.eu/eurostat/databrowser/view/ilc_mddw01/default/table?lang=en); Annex 5 PDF: [`../../raw/eurostat/ilc_sieusilc_an_Annex_5-SampSize_rotat_nonresp.pdf`](../../raw/eurostat/ilc_sieusilc_an_Annex_5-SampSize_rotat_nonresp.pdf).

**Coverage:** 36 rows with a 2023 %; 31 with household sample size. Missing sample: AL, ME, MK (not in Annex 5 Table 2).
