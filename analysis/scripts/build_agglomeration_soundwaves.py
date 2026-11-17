#!/usr/bin/env python3
"""Build concentric sound-wave ring GeoJSON from END agglomeration exposure.

Encoding
--------
- One ring ≈ PEOPLE_PER_RING people (default 10_000), capped per band.
- Lower dB bands → smaller radii; higher (red) bands → outer radii.
- Within a band, ring radii use slightly tightening (exponential) spacing.
- Contour polygons are not used; this is the Europe-wide city layer.
"""

from __future__ import annotations

import argparse
import csv
import json
import math
import re
import unicodedata
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
EXPOSURE = ROOT / "data/processed/eea-end/exposure_agglomeration_long.csv"
GEONAMES = ROOT / "data/raw/geocode/cities5000.txt"
OUT_GEOJSON = ROOT / "app/public/data/agglomeration_soundwaves.geojson"
OUT_CHART = ROOT / "app/public/data/agglomeration_chart.json"
OUT_META = ROOT / "data/processed/map/agglomeration_soundwaves_meta.json"
CACHE = ROOT / "data/processed/map/agglomeration_geocode_cache.json"

PEOPLE_PER_RING = 10_000
MAX_RINGS_PER_BAND = 12
RING_VERTICES = 32

# END CSV uses "air"; map UI uses "aircraft"
SOURCE_MAP = {"road": "road", "rail": "rail", "air": "aircraft", "industry": "industry"}

COUNTRY_TO_ISO = {
    "Austria": "AT",
    "Belgium": "BE",
    "Bulgaria": "BG",
    "Croatia": "HR",
    "Cyprus": "CY",
    "Czech Republic": "CZ",
    "Denmark": "DK",
    "Estonia": "EE",
    "Finland": "FI",
    "France": "FR",
    "Germany": "DE",
    "Greece": "GR",
    "Hungary": "HU",
    "Iceland": "IS",
    "Ireland": "IE",
    "Italy": "IT",
    "Latvia": "LV",
    "Liechtenstein": "LI",
    "Lithuania": "LT",
    "Luxembourg": "LU",
    "Malta": "MT",
    "Netherlands": "NL",
    "Norway": "NO",
    "Poland": "PL",
    "Portugal": "PT",
    "Romania": "RO",
    "Slovakia": "SK",
    "Slovenia": "SI",
    "Spain": "ES",
    "Sweden": "SE",
    "Switzerland": "CH",
    "Turkey": "TR",
}

LDEN_BANDS = [
    {"band": "55-59", "label": "55–59 dB", "color": "#3d5afe", "order": 0},
    {"band": "60-64", "label": "60–64 dB", "color": "#00e5ff", "order": 1},
    {"band": "65-69", "label": "65–69 dB", "color": "#76ff03", "order": 2},
    {"band": "70-74", "label": "70–74 dB", "color": "#ffea00", "order": 3},
    {"band": ">75", "label": "≥75 dB", "color": "#ff1744", "order": 4},
]

LNIGHT_BANDS = [
    {"band": "50-54", "label": "50–54 dB", "color": "#3d5afe", "order": 0},
    {"band": "55-59", "label": "55–59 dB", "color": "#00e5ff", "order": 1},
    {"band": "60-64", "label": "60–64 dB", "color": "#76ff03", "order": 2},
    {"band": "65-69", "label": "65–69 dB", "color": "#ffea00", "order": 3},
    {"band": ">70", "label": "≥70 dB", "color": "#ff1744", "order": 4},
]

# Manual overrides for awkward END names / capital preference
NAME_OVERRIDES: dict[tuple[str, str], str] = {
    ("Belgium", "Brussels-Capital"): "Brussels",
    ("Belgium", "Bruxelles"): "Brussels",
    ("Spain", "A Coruna"): "A Coruña",
    ("Spain", "Alcala de Henares"): "Alcalá de Henares",
    ("Spain", "Malaga"): "Málaga",
    ("Spain", "Cordoba"): "Córdoba",
    ("Spain", "Leon"): "León",
    ("Spain", "Gijon"): "Gijón",
    ("Portugal", "Lisbon"): "Lisbon",
    ("Portugal", "Oporto"): "Porto",
    ("Czech Republic", "Prague"): "Prague",
    ("Netherlands", "The Hague"): "'s-Gravenhage",
    ("Netherlands", "Den Haag"): "'s-Gravenhage",
    ("Switzerland", "Geneva"): "Geneva",
    ("Switzerland", "Zurich"): "Zürich",
    ("Switzerland", "Berne"): "Bern",
    ("Italy", "Rome"): "Rome",
    ("Italy", "Milan"): "Milan",
    ("Italy", "Turin"): "Turin",
    ("Italy", "Naples"): "Naples",
    ("Greece", "Athens"): "Athens",
    ("Greece", "Thessaloniki"): "Thessaloniki",
    ("Poland", "Warsaw"): "Warsaw",
    ("Poland", "Cracow"): "Krakow",
    ("Poland", "Krakow"): "Krakow",
    ("Turkey", "Istanbul"): "Istanbul",
    ("Cyprus", "Nicosia"): "Nicosia",
    ("Malta", "Valletta"): "Valletta",
}


def norm(s: str) -> str:
    s = unicodedata.normalize("NFKD", s)
    s = "".join(c for c in s if not unicodedata.combining(c))
    s = s.lower().strip()
    s = re.sub(r"[^a-z0-9]+", " ", s)
    return re.sub(r"\s+", " ", s).strip()


def load_geonames(path: Path) -> dict[str, list[dict]]:
    """Index by ISO country → list of cities (prefer population)."""
    by_country: dict[str, list[dict]] = defaultdict(list)
    with path.open(encoding="utf-8") as f:
        for line in f:
            parts = line.rstrip("\n").split("\t")
            if len(parts) < 15:
                continue
            # 1 name, 2 asciiname, 3 alternatenames, 4 lat, 5 lon, 8 country, 14 population
            name = parts[1]
            ascii_name = parts[2]
            alts = parts[3].split(",") if parts[3] else []
            try:
                lat = float(parts[4])
                lon = float(parts[5])
                pop = int(parts[14] or 0)
            except ValueError:
                continue
            iso = parts[8]
            if iso not in set(COUNTRY_TO_ISO.values()):
                continue
            entry = {
                "name": name,
                "ascii": ascii_name,
                "alts": alts,
                "lat": lat,
                "lon": lon,
                "pop": pop,
                "keys": {norm(name), norm(ascii_name), *(norm(a) for a in alts if a)},
            }
            by_country[iso].append(entry)
    for iso in by_country:
        by_country[iso].sort(key=lambda e: e["pop"], reverse=True)
    return by_country


def match_city(
    country: str,
    agglomeration: str,
    by_country: dict[str, list[dict]],
    cache: dict[str, dict],
) -> dict | None:
    key = f"{country}|{agglomeration}"
    if key in cache:
        c = cache[key]
        return c if c.get("lat") is not None else None

    iso = COUNTRY_TO_ISO.get(country)
    if not iso:
        cache[key] = {"lat": None, "lon": None, "matched": None}
        return None

    query = NAME_OVERRIDES.get((country, agglomeration), agglomeration)
    # Strip parenthetical / slash variants: "Paris (greater)", "Biel/Bienne"
    query_base = re.split(r"[/(]", query)[0].strip()
    qn = norm(query_base)
    candidates = by_country.get(iso, [])

    # Exact key match, highest population first (already sorted)
    for e in candidates:
        if qn in e["keys"]:
            hit = {"lat": e["lat"], "lon": e["lon"], "matched": e["name"], "pop": e["pop"]}
            cache[key] = hit
            return hit

    # Prefix / contains soft match
    for e in candidates:
        for k in e["keys"]:
            if not k:
                continue
            if k.startswith(qn) or qn.startswith(k) or qn in k or k in qn:
                if abs(len(k) - len(qn)) <= 4 or min(len(k), len(qn)) >= 5:
                    hit = {"lat": e["lat"], "lon": e["lon"], "matched": e["name"], "pop": e["pop"]}
                    cache[key] = hit
                    return hit

    cache[key] = {"lat": None, "lon": None, "matched": None}
    return None


def ring_coords(lon: float, lat: float, radius_km: float, n: int = RING_VERTICES) -> list[list[float]]:
    """Approximate geodesic circle in WGS84 (good enough at city scale)."""
    lat_rad = math.radians(lat)
    deg_lat = radius_km / 111.32
    deg_lon = radius_km / (111.32 * max(math.cos(lat_rad), 0.2))
    coords = []
    for i in range(n + 1):
        ang = 2 * math.pi * i / n
        coords.append(
            [
                round(lon + deg_lon * math.cos(ang), 5),
                round(lat + deg_lat * math.sin(ang), 5),
            ]
        )
    return coords


def rings_for_people(people: float) -> int:
    if people <= 0:
        return 0
    n = int(math.ceil(people / PEOPLE_PER_RING))
    return min(MAX_RINGS_PER_BAND, max(1, n))


RING_STEP_KM = 0.55
RING_BASE_KM = 1.2


def equal_spaced_radii(start_index: int, n_rings: int) -> list[float]:
    """Constant distance between consecutive rings (no extra gap for sparse bands)."""
    return [RING_BASE_KM + (start_index + i) * RING_STEP_KM for i in range(n_rings)]


def load_exposure(path: Path):
    """Return dict[(country, aggl)] -> meta + values[source][metric][band] = people."""
    meta: dict[tuple[str, str], dict] = {}
    # country/aggl → source → metric → band → people
    values: dict[tuple[str, str], dict] = defaultdict(
        lambda: defaultdict(lambda: defaultdict(dict))
    )

    lden_set = {b["band"] for b in LDEN_BANDS}
    lnight_set = {b["band"] for b in LNIGHT_BANDS}

    with path.open(newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            if row["measure"] != "people":
                continue
            src = SOURCE_MAP.get(row["source"])
            if not src:
                continue
            metric = row["metric"]
            band = row["band"]
            if metric == "Lden" and band not in lden_set:
                continue
            if metric == "Lnight" and band not in lnight_set:
                continue
            try:
                people = float(row["value"]) if row["value"] not in ("", None) else 0.0
            except ValueError:
                people = 0.0
            key = (row["country"], row["agglomeration"])
            if key not in meta:
                meta[key] = {
                    "country": row["country"],
                    "agglomeration": row["agglomeration"],
                    "inhabitants": float(row["inhabitants"] or 0) if row["inhabitants"] else 0,
                    "area_km2": float(row["area_km2"] or 0) if row["area_km2"] else 0,
                }
            values[key][src][metric][band] = people
    return meta, values


def mean_db_approx(metric: str, band_people: dict[str, float]) -> float | None:
    """Population-weighted midpoints of reported bands (rough mean dB)."""
    mids = (
        {"55-59": 57.0, "60-64": 62.0, "65-69": 67.0, "70-74": 72.0, ">75": 77.0}
        if metric == "Lden"
        else {"50-54": 52.0, "55-59": 57.0, "60-64": 62.0, "65-69": 67.0, ">70": 72.0}
    )
    num = den = 0.0
    for b, mid in mids.items():
        p = band_people.get(b, 0.0)
        if p > 0:
            num += p * mid
            den += p
    return round(num / den, 1) if den else None


def build(people_per_ring: int, max_rings: int) -> None:
    global PEOPLE_PER_RING, MAX_RINGS_PER_BAND
    PEOPLE_PER_RING = people_per_ring
    MAX_RINGS_PER_BAND = max_rings

    meta, values = load_exposure(EXPOSURE)
    by_country = load_geonames(GEONAMES)
    cache: dict[str, dict] = {}
    if CACHE.exists():
        cache = json.loads(CACHE.read_text())

    features = []
    centers = []
    unmatched = []
    geocoded = 0

    for key, m in sorted(meta.items(), key=lambda kv: (kv[0][0], kv[0][1])):
        hit = match_city(m["country"], m["agglomeration"], by_country, cache)
        if not hit:
            unmatched.append(f"{m['country']} / {m['agglomeration']}")
            continue
        geocoded += 1
        lon, lat = hit["lon"], hit["lat"]

        # Compact tooltip payloads per source×metric (stringified JSON for MapLibre props)
        tooltip: dict[str, dict] = {}
        for source, metrics in values[key].items():
            for metric, bands in metrics.items():
                band_defs = LDEN_BANDS if metric == "Lden" else LNIGHT_BANDS
                mean_db = mean_db_approx(metric, bands)
                band_people = {
                    bdef["band"]: float(bands.get(bdef["band"], 0.0) or 0.0) for bdef in band_defs
                }
                total = sum(band_people.values())
                tooltip[f"{source}__{metric}"] = {
                    "mean_db": mean_db,
                    "total": total,
                    "bands": [
                        {
                            "band": bdef["band"],
                            "label": bdef["label"],
                            "color": bdef["color"],
                            "people": band_people[bdef["band"]],
                            "rings": rings_for_people(band_people[bdef["band"]]),
                        }
                        for bdef in band_defs
                    ],
                }

        center_props: dict = {
            "kind": "center",
            "country": m["country"],
            "agglomeration": m["agglomeration"],
            "inhabitants": m["inhabitants"],
            "area_km2": m["area_km2"],
            "matched": hit.get("matched"),
            "tooltip": json.dumps(tooltip, separators=(",", ":")),
        }
        # Flat totals for MapLibre filters (hide centers with no people for a toggle)
        any_data = False
        for tip_key, tip_val in tooltip.items():
            total = float(tip_val.get("total") or 0)
            center_props[f"total__{tip_key}"] = total
            if total > 0:
                any_data = True
        center_props["has_any_data"] = 1 if any_data else 0

        # Skip places with zero exposure across every source×metric
        if not any_data:
            continue

        centers.append(
            {
                "type": "Feature",
                "geometry": {"type": "Point", "coordinates": [lon, lat]},
                "properties": center_props,
            }
        )

        for source, metrics in values[key].items():
            for metric, bands in metrics.items():
                band_defs = LDEN_BANDS if metric == "Lden" else LNIGHT_BANDS
                mean_db = mean_db_approx(metric, bands)
                ring_index = 0
                for bdef in band_defs:
                    people = float(bands.get(bdef["band"], 0.0) or 0.0)
                    n = rings_for_people(people)
                    if n == 0:
                        continue
                    radii = equal_spaced_radii(ring_index, n)
                    for radius_km in radii:
                        features.append(
                            {
                                "type": "Feature",
                                "geometry": {
                                    "type": "LineString",
                                    "coordinates": ring_coords(lon, lat, radius_km),
                                },
                                "properties": {
                                    "kind": "ring",
                                    "country": m["country"],
                                    "agglomeration": m["agglomeration"],
                                    "source": source,
                                    "metric": metric,
                                    "band": bdef["band"],
                                    "band_label": bdef["label"],
                                    "color": bdef["color"],
                                    "band_order": bdef["order"],
                                    "people": people,
                                    "people_per_ring": PEOPLE_PER_RING,
                                    "ring_index": ring_index,
                                    "rings_in_band": n,
                                    "radius_km": round(radius_km, 3),
                                    "mean_db": mean_db,
                                    "inhabitants": m["inhabitants"],
                                },
                            }
                        )
                        ring_index += 1

    CACHE.parent.mkdir(parents=True, exist_ok=True)
    CACHE.write_text(json.dumps(cache, indent=2, ensure_ascii=False))

    fc = {
        "type": "FeatureCollection",
        "features": features + centers,
    }
    OUT_GEOJSON.parent.mkdir(parents=True, exist_ok=True)
    OUT_GEOJSON.write_text(json.dumps(fc, separators=(",", ":")))

    # Also copy under processed/
    processed = ROOT / "data/processed/map/agglomeration_soundwaves.geojson"
    processed.write_text(OUT_GEOJSON.read_text())

    chart_cities = []
    for c in centers:
        p = c["properties"]
        lon, lat = c["geometry"]["coordinates"]
        chart_cities.append(
            {
                "id": f"{p['country']}|{p['agglomeration']}",
                "agglomeration": p["agglomeration"],
                "country": p["country"],
                "inhabitants": p.get("inhabitants") or 0,
                "lon": lon,
                "lat": lat,
                "series": json.loads(p.get("tooltip") or "{}"),
            }
        )
    OUT_CHART.write_text(json.dumps({"cities": chart_cities}, separators=(",", ":")))

    meta_out = {
        "people_per_ring": PEOPLE_PER_RING,
        "max_rings_per_band": MAX_RINGS_PER_BAND,
        "agglomerations_total": len(meta),
        "agglomerations_geocoded": geocoded,
        "agglomerations_with_data": len(centers),
        "agglomerations_unmatched": unmatched,
        "ring_features": sum(1 for f in features if f["properties"]["kind"] == "ring"),
        "output": str(OUT_GEOJSON.relative_to(ROOT)),
        "chart": str(OUT_CHART.relative_to(ROOT)),
    }
    OUT_META.write_text(json.dumps(meta_out, indent=2, ensure_ascii=False))
    print(json.dumps(meta_out, indent=2, ensure_ascii=False))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--people-per-ring", type=int, default=10_000)
    ap.add_argument("--max-rings-per-band", type=int, default=12)
    args = ap.parse_args()
    build(args.people_per_ring, args.max_rings_per_band)


if __name__ == "__main__":
    main()
