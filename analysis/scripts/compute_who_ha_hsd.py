#!/usr/bin/env python3
"""Compute WHO 2018 %HA / %HSD people counts per END agglomeration × source.

Inputs
------
data/processed/eea-end/exposure_agglomeration_long.csv
  (from process_exposure.py)

Exposure–response functions (WHO ENG 2018 / EEA HA–HSD practice)
----------------------------------------------------------------
%HA vs Lden — Guski, Schreckenberg & Schuemer (2017), WHO systematic review:

  road:     %HA  = 78.9270  - 3.1162·L  + 0.0342·L²
  rail:     %HA  = 38.1596  - 2.05538·L + 0.0285·L²
  aircraft: %HA  = -50.9693 + 1.016813·L + 0.0071645·L²

%HSD vs Lnight — Basner & McGuire (2018), WHO systematic review:

  road:     %HSD = 19.4312 - 0.9336·L + 0.0126·L²
  rail:     %HSD = 67.5406 - 3.1852·L + 0.0391·L²
  aircraft: %HSD = 18.1472 - 0.9560·L + 0.0149·L²

Industry: no WHO transport-style %HA/%HSD ERF in ENG 2018 — skipped.

Method notes (documented gaps)
------------------------------
- Population: END band people counts as reported (all ages). No age structure
  in the exposure table → cannot restrict to adults ≥18 as EEA BoD often does.
- Band evaluation: ERF at 5 dB band midpoints; open-ended >75 / >70 use 77 / 72.
- Floors: voluntary END bands from Lden 45 and Lnight 40 are used when present.
  WHO source-specific guideline values (e.g. road 53/45) are not used as hard
  cut-offs; polynomials are evaluated at midpoints and clamped to [0, 100] %.
- Source key: CSV uses ``air``; output also emits ``aircraft`` alias column value
  ``aircraft`` for map/soundwave alignment while keeping ``source_end=air``.
"""

from __future__ import annotations

import argparse
import csv
import math
from collections import defaultdict
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
DEFAULT_IN = REPO / "data/processed/eea-end/exposure_agglomeration_long.csv"
DEFAULT_OUT = REPO / "data/processed/eea-end/exposure_agglomeration_who_ha_hsd.csv"
DEFAULT_BAND_OUT = (
    REPO / "data/processed/eea-end/exposure_agglomeration_who_ha_hsd_by_band.csv"
)

# Midpoints for END 5 dB classes
LDEN_MID = {
    "45-49": 47.0,
    "50-54": 52.0,
    "55-59": 57.0,
    "60-64": 62.0,
    "65-69": 67.0,
    "70-74": 72.0,
    ">75": 77.0,
}
LNIGHT_MID = {
    "40-44": 42.0,
    "45-49": 47.0,
    "50-54": 52.0,
    "55-59": 57.0,
    "60-64": 62.0,
    "65-69": 67.0,
    ">70": 72.0,
}

# Map END source codes → WHO ERF family
SOURCE_ERF = {
    "road": "road",
    "rail": "rail",
    "air": "aircraft",
    "aircraft": "aircraft",
}

SOURCE_OUT = {
    "road": "road",
    "rail": "rail",
    "air": "aircraft",
    "aircraft": "aircraft",
}


def pct_ha(source_erf: str, lden: float) -> float:
    L = lden
    if source_erf == "road":
        p = 78.9270 - 3.1162 * L + 0.0342 * L * L
    elif source_erf == "rail":
        p = 38.1596 - 2.05538 * L + 0.0285 * L * L
    elif source_erf == "aircraft":
        p = -50.9693 + 1.016813 * L + 0.0071645 * L * L
    else:
        raise KeyError(source_erf)
    return float(min(100.0, max(0.0, p)))


def pct_hsd(source_erf: str, lnight: float) -> float:
    L = lnight
    if source_erf == "road":
        p = 19.4312 - 0.9336 * L + 0.0126 * L * L
    elif source_erf == "rail":
        p = 67.5406 - 3.1852 * L + 0.0391 * L * L
    elif source_erf == "aircraft":
        p = 18.1472 - 0.9560 * L + 0.0149 * L * L
    else:
        raise KeyError(source_erf)
    return float(min(100.0, max(0.0, p)))


def parse_people(v: str) -> float | None:
    if v is None:
        return None
    s = str(v).strip()
    if not s:
        return None
    try:
        x = float(s)
    except ValueError:
        return None
    if math.isnan(x) or x < 0:
        return None
    return x


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--input", type=Path, default=DEFAULT_IN)
    ap.add_argument("--output", type=Path, default=DEFAULT_OUT)
    ap.add_argument("--band-output", type=Path, default=DEFAULT_BAND_OUT)
    args = ap.parse_args()

    # key: (country, aggl, source_end) → meta + band people
    meta: dict[tuple, dict] = {}
    lden_people: dict[tuple, dict[str, float]] = defaultdict(dict)
    lnight_people: dict[tuple, dict[str, float]] = defaultdict(dict)
    skipped_industry = 0

    with args.input.open(newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            if row.get("measure") != "people":
                continue
            if row.get("scope") and row["scope"] != "agglomeration":
                continue
            src_end = row["source"]
            if src_end == "industry":
                skipped_industry += 1
                continue
            if src_end not in SOURCE_ERF:
                continue
            people = parse_people(row.get("value", ""))
            if people is None:
                continue
            key = (row["country"], row["agglomeration"], src_end)
            if key not in meta:
                meta[key] = {
                    "country": row["country"],
                    "eu": row.get("eu", ""),
                    "agglomeration": row["agglomeration"],
                    "inhabitants": parse_people(row.get("inhabitants", "")) or "",
                    "area_km2": parse_people(row.get("area_km2", "")) or "",
                    "source_end": src_end,
                    "source": SOURCE_OUT[src_end],
                }
            band = row["band"]
            if row["metric"] == "Lden" and band in LDEN_MID:
                lden_people[key][band] = people
            elif row["metric"] == "Lnight" and band in LNIGHT_MID:
                lnight_people[key][band] = people

    summary_rows: list[dict] = []
    band_rows: list[dict] = []

    for key in sorted(meta.keys(), key=lambda k: (k[0], k[1], k[2])):
        m = meta[key]
        erf = SOURCE_ERF[m["source_end"]]

        ha_sum = 0.0
        hsd_sum = 0.0
        exposed_lden = 0.0
        exposed_lnight = 0.0

        for band, mid in LDEN_MID.items():
            people = lden_people[key].get(band)
            if people is None:
                continue
            p_ha = pct_ha(erf, mid)
            n_ha = people * p_ha / 100.0
            ha_sum += n_ha
            exposed_lden += people
            band_rows.append(
                {
                    **m,
                    "metric": "Lden",
                    "band": band,
                    "band_midpoint_db": mid,
                    "people_exposed": round(people, 3),
                    "erf_pct": round(p_ha, 6),
                    "outcome": "HA",
                    "people_outcome": round(n_ha, 3),
                }
            )

        for band, mid in LNIGHT_MID.items():
            people = lnight_people[key].get(band)
            if people is None:
                continue
            p_hsd = pct_hsd(erf, mid)
            n_hsd = people * p_hsd / 100.0
            hsd_sum += n_hsd
            exposed_lnight += people
            band_rows.append(
                {
                    **m,
                    "metric": "Lnight",
                    "band": band,
                    "band_midpoint_db": mid,
                    "people_exposed": round(people, 3),
                    "erf_pct": round(p_hsd, 6),
                    "outcome": "HSD",
                    "people_outcome": round(n_hsd, 3),
                }
            )

        if exposed_lden <= 0 and exposed_lnight <= 0:
            continue

        summary_rows.append(
            {
                "country": m["country"],
                "eu": m["eu"],
                "agglomeration": m["agglomeration"],
                "inhabitants": m["inhabitants"],
                "area_km2": m["area_km2"],
                "source_end": m["source_end"],
                "source": m["source"],
                "scope": "agglomeration",
                "people_exposed_lden": round(exposed_lden, 3),
                "people_exposed_lnight": round(exposed_lnight, 3),
                "people_highly_annoyed": round(ha_sum, 3),
                "people_highly_sleep_disturbed": round(hsd_sum, 3),
                "age_filter": "none_total_end_exposed",
                "erf_family": "WHO_ENG_2018_Guski2017_Basner2018",
            }
        )

    args.output.parent.mkdir(parents=True, exist_ok=True)
    sum_fields = [
        "country",
        "eu",
        "agglomeration",
        "inhabitants",
        "area_km2",
        "source_end",
        "source",
        "scope",
        "people_exposed_lden",
        "people_exposed_lnight",
        "people_highly_annoyed",
        "people_highly_sleep_disturbed",
        "age_filter",
        "erf_family",
    ]
    with args.output.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=sum_fields)
        w.writeheader()
        w.writerows(summary_rows)

    band_fields = [
        "country",
        "eu",
        "agglomeration",
        "inhabitants",
        "area_km2",
        "source_end",
        "source",
        "metric",
        "band",
        "band_midpoint_db",
        "people_exposed",
        "erf_pct",
        "outcome",
        "people_outcome",
    ]
    with args.band_output.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=band_fields)
        w.writeheader()
        w.writerows(band_rows)

    print(
        {
            "input": str(args.input.relative_to(REPO)),
            "output": str(args.output.relative_to(REPO)),
            "band_output": str(args.band_output.relative_to(REPO)),
            "summary_rows": len(summary_rows),
            "band_rows": len(band_rows),
            "industry_input_rows_skipped": skipped_industry,
            "sources": sorted({r["source"] for r in summary_rows}),
            "agglomerations": len({(r["country"], r["agglomeration"]) for r in summary_rows}),
        }
    )


if __name__ == "__main__":
    main()
