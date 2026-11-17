#!/usr/bin/env python3
"""Build ThemeRiver payload: HA/HSD per agglomeration × source, pre-sorted.

Sort key (per source):
  countries left→right by descending sum of city highest-band scores;
  city score = max(people in highest non-empty Lden band,
                   people in highest non-empty Lnight band);
  within country: HA + HSD descending.

Output: app/public/data/agglomeration_ha_hsd_stream.json
"""

from __future__ import annotations

import argparse
import csv
import json
import math
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
HA_HSD = ROOT / "data/processed/eea-end/exposure_agglomeration_who_ha_hsd.csv"
EXPOSURE = ROOT / "data/processed/eea-end/exposure_agglomeration_long.csv"
OUT = ROOT / "app/public/data/agglomeration_ha_hsd_stream.json"

SOURCES = ("road", "rail", "aircraft")
SOURCE_END = {"road": "road", "rail": "rail", "aircraft": "air"}

LDEN_HIGH_TO_LOW = [">75", "70-74", "65-69", "60-64", "55-59", "50-54", "45-49"]
LNIGHT_HIGH_TO_LOW = [">70", "65-69", "60-64", "55-59", "50-54", "45-49", "40-44"]


def _f(v: str) -> float:
    s = (v or "").strip()
    if not s:
        return 0.0
    try:
        x = float(s)
    except ValueError:
        return 0.0
    if math.isnan(x) or x < 0:
        return 0.0
    return x


def top_band_people(band_people: dict[str, float], order: list[str]) -> float:
    for b in order:
        p = band_people.get(b, 0.0)
        if p > 0:
            return p
    return 0.0


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--ha-hsd", type=Path, default=HA_HSD)
    ap.add_argument("--exposure", type=Path, default=EXPOSURE)
    ap.add_argument("--output", type=Path, default=OUT)
    args = ap.parse_args()

    # exposure bands: (country, aggl, source_ui, metric) → {band: people}
    bands: dict[tuple[str, str, str, str], dict[str, float]] = defaultdict(dict)
    with args.exposure.open(newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            if row.get("measure") != "people":
                continue
            src_end = row["source"]
            if src_end == "industry":
                continue
            src = {"road": "road", "rail": "rail", "air": "aircraft"}.get(src_end)
            if not src:
                continue
            people = _f(row.get("value", ""))
            if people <= 0:
                continue
            key = (row["country"], row["agglomeration"], src, row["metric"])
            bands[key][row["band"]] = people

    # HA/HSD rows
    ha_rows: list[dict] = []
    with args.ha_hsd.open(newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            src = row["source"]
            if src not in SOURCES:
                continue
            ha = _f(row["people_highly_annoyed"])
            hsd = _f(row["people_highly_sleep_disturbed"])
            if ha <= 0 and hsd <= 0:
                continue
            country = row["country"]
            aggl = row["agglomeration"]
            lden = bands.get((country, aggl, src, "Lden"), {})
            lnight = bands.get((country, aggl, src, "Lnight"), {})
            score = max(
                top_band_people(lden, LDEN_HIGH_TO_LOW),
                top_band_people(lnight, LNIGHT_HIGH_TO_LOW),
            )
            ha_rows.append(
                {
                    "id": f"{country}|{aggl}",
                    "agglomeration": aggl,
                    "country": country,
                    "source": src,
                    "ha": round(ha, 3),
                    "hsd": round(hsd, 3),
                    "highest_band_score": round(score, 3),
                }
            )

    by_source: dict[str, dict] = {}
    for src in SOURCES:
        cities = [r for r in ha_rows if r["source"] == src]
        # country scores
        country_score: dict[str, float] = defaultdict(float)
        for c in cities:
            country_score[c["country"]] += c["highest_band_score"]
        countries_ordered = sorted(
            country_score.keys(),
            key=lambda c: (-country_score[c], c),
        )
        country_rank = {c: i for i, c in enumerate(countries_ordered)}

        cities.sort(
            key=lambda c: (
                country_rank[c["country"]],
                -(c["ha"] + c["hsd"]),
                c["agglomeration"],
            )
        )

        # country tick spans (city index ranges)
        ticks: list[dict] = []
        i = 0
        while i < len(cities):
            country = cities[i]["country"]
            j = i
            while j < len(cities) and cities[j]["country"] == country:
                j += 1
            ticks.append(
                {
                    "country": country,
                    "i0": i,
                    "i1": j - 1,
                    "mid": (i + j - 1) / 2,
                    "score": country_score[country],
                }
            )
            i = j

        by_source[src] = {
            "cities": [
                {
                    "id": c["id"],
                    "agglomeration": c["agglomeration"],
                    "country": c["country"],
                    "ha": c["ha"],
                    "hsd": c["hsd"],
                    "highest_band_score": c["highest_band_score"],
                }
                for c in cities
            ],
            "countryTicks": ticks,
            "n": len(cities),
        }

    payload = {
        "streams": ["ha", "hsd"],
        "streamLabels": {
            "ha": "Highly annoyed",
            "hsd": "Highly sleep disturbed",
        },
        "bySource": by_source,
        "notes": (
            "Countries ordered by sum of city max(top Lden band people, "
            "top Lnight band people) for the active source; cities within "
            "country by HA+HSD desc."
        ),
    }

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(payload, separators=(",", ":")), encoding="utf-8")
    print(
        {
            "output": str(args.output.relative_to(ROOT)),
            "bytes": args.output.stat().st_size,
            **{s: by_source[s]["n"] for s in SOURCES},
        }
    )


if __name__ == "__main__":
    main()
