#!/usr/bin/env python3
"""Build MapLibre-ready PMTiles from EEA END contour GeoPackages.

For each ready country package:
  - extract layers for road / rail / aircraft / industry × Lden / Lnight
  - reproject EPSG:3035 → EPSG:4326
  - simplify + dissolve by dB category
  - tippecanoe → PMTiles under data/processed/map/ and app/public/data/

Skip incomplete packages. DE .7z is optional (extract on demand).
"""

from __future__ import annotations

import argparse
import json
import re
import shutil
import subprocess
import tempfile
from pathlib import Path

import geopandas as gpd
import pandas as pd
import pyogrio
from shapely import make_valid
from shapely.geometry import mapping
from shapely.ops import unary_union

REPO = Path(__file__).resolve().parents[2]
CONT_DIR = REPO / "data" / "raw" / "eea-end" / "contours"
OUT_DIR = REPO / "data" / "processed" / "map"
PUBLIC_DIR = REPO / "app" / "public" / "data"

PUBLISHED_SIZES = {
    "AT.gpkg": 2940518400,
    "BE.gpkg": 3880706048,
    "CH.gpkg": 1121607680,
    "CY.gpkg": 219697152,
    "CZ.gpkg": 609054720,
    "DK.gpkg": 255508480,
    "EE.gpkg": 73924608,
    "ES.gpkg": 1644613632,
    "FI.gpkg": 331370496,
    "FR.gpkg": 7611727872,
    "HR.gpkg": 1402716160,
    "IE.gpkg": 2158432256,
    "IT.gpkg": 12571758592,
    "LT.gpkg": 210378752,
    "LU.gpkg": 1128792064,
    "LV.gpkg": 63721472,
    "MT.gpkg": 183537664,
    "NL.gpkg": 1055731712,
    "NO.gpkg": 575995904,
    "PL.gpkg": 9299005440,
    "PT.gpkg": 167600128,
    "RO.gpkg": 216272896,
    "SE.gpkg": 7117332480,
}

# Viz sources → END layer source name fragments
SOURCE_LAYERS = {
    "road": [
        "roadsInAgglomeration",
        "majorRoadsIncludingAgglomeration",
    ],
    "rail": [
        "railwaysInAgglomeration",
        "majorRailwaysIncludingAgglomeration",
    ],
    "aircraft": [
        "airportsInAgglomeration",
        "majorAirportsIncludingAgglomeration",
    ],
    "industry": [
        "industryInAgglomeration",
    ],
}

METRICS = ("Lden", "Lnight")
LAYER_RE = re.compile(r"^NoiseContours_(?P<source>.+)_(?P<metric>Lden|Lnight)$")

# Keep END-threshold bands (+ voluntary lower bands if present, mapped into display class)
BAND_ORDER = [
    "LdenLowerThan40",
    "Lden4044",
    "Lden4549",
    "Lden5054",
    "Lden5559",
    "Lden6064",
    "Lden6569",
    "Lden7074",
    "LdenGreaterThan75",
    "LnightLowerThan40",
    "Lnight4044",
    "Lnight4549",
    "Lnight5054",
    "Lnight5559",
    "Lnight6064",
    "Lnight6569",
    "LnightGreaterThan70",
]


def is_ready(path: Path) -> bool:
    if path.suffix.lower() != ".gpkg" or not path.exists():
        return False
    exp = PUBLISHED_SIZES.get(path.name)
    if exp is None:
        try:
            pyogrio.list_layers(path)
            return True
        except Exception:
            return False
    return path.stat().st_size == exp


def parse_layer(name: str) -> tuple[str, str] | None:
    m = LAYER_RE.match(name)
    if not m:
        return None
    return m.group("source"), m.group("metric")


def simplify_tolerance_m(package_bytes: int) -> float:
    """Stronger simplify for huge national packages."""
    gb = package_bytes / 1e9
    if gb >= 8:
        return 250.0
    if gb >= 3:
        return 150.0
    if gb >= 1:
        return 100.0
    return 60.0


def load_and_prep_layer(
    path: Path,
    layer: str,
    country: str,
    tol_m: float,
    batch_size: int = 40_000,
) -> gpd.GeoDataFrame | None:
    info = pyogrio.read_info(path, layer=layer)
    n = int(info.get("features") or 0)
    if n == 0:
        return None

    parts: list[gpd.GeoDataFrame] = []
    for start in range(0, n, batch_size):
        gdf = pyogrio.read_dataframe(
            path,
            layer=layer,
            skip_features=start,
            max_features=batch_size,
            columns=["category", "source", "countryCode"],
        )
        if gdf.empty:
            break
        parts.append(gdf)
        if len(gdf) < batch_size:
            break
    gdf = pd.concat(parts, ignore_index=True)
    gdf = gpd.GeoDataFrame(gdf, geometry="geometry", crs=info.get("crs") or "EPSG:3035")
    if str(gdf.crs) != "EPSG:3035":
        gdf = gdf.to_crs(3035)

    gdf["geometry"] = gdf.geometry.map(lambda g: make_valid(g) if g is not None else g)
    gdf = gdf[~gdf.geometry.is_empty & gdf.geometry.notna()].copy()
    if gdf.empty:
        return None

    # Simplify first (cheap), then dissolve — avoids O(n²) unary_union on dense roads
    pre_tol = max(tol_m * 0.5, 30.0)
    gdf["geometry"] = gdf.geometry.simplify(pre_tol, preserve_topology=True)
    gdf = gdf[~gdf.geometry.is_empty & gdf.geometry.notna()].copy()
    if gdf.empty:
        return None

    dissolved = gdf.dissolve(by="category", as_index=False)
    dissolved["geometry"] = dissolved.geometry.map(
        lambda g: make_valid(g.simplify(tol_m, preserve_topology=True)) if g is not None else g
    )
    dissolved = dissolved[~dissolved.geometry.is_empty & dissolved.geometry.notna()].copy()
    if dissolved.empty:
        return None
    dissolved["country"] = country
    out = dissolved[["category", "country", "geometry"]].to_crs(4326)
    out["geometry"] = out.geometry.map(lambda g: make_valid(g) if g is not None else g)
    out = out[~out.geometry.is_empty & out.geometry.notna()]
    return out if not out.empty else None


def write_geojson(gdf: gpd.GeoDataFrame, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    # Drop Z if any; keep properties lean
    feats = []
    for _, row in gdf.iterrows():
        feats.append(
            {
                "type": "Feature",
                "properties": {
                    "category": row["category"],
                    "country": row["country"],
                },
                "geometry": mapping(row.geometry),
            }
        )
    path.write_text(
        json.dumps({"type": "FeatureCollection", "features": feats}, separators=(",", ":")),
        encoding="utf-8",
    )


def build_pmtiles(inputs: list[Path], out_path: Path, layer_name: str) -> None:
    out_path.parent.mkdir(parents=True, exist_ok=True)
    if out_path.exists():
        out_path.unlink()
    cmd = [
        "tippecanoe",
        "-o",
        str(out_path),
        "-l",
        layer_name,
        "-zg",
        "--drop-densest-as-needed",
        "--extend-zooms-if-still-dropping",
        "--simplification=10",
        "--simplify-only-low-zooms",
        "--force",
        "--read-parallel",
        *[str(p) for p in inputs],
    ]
    print(" ", " ".join(cmd[:8]), f"... ({len(inputs)} files)", flush=True)
    subprocess.check_call(cmd)


def process_country(
    path: Path,
    workdir: Path,
    sources: list[str],
    metrics: list[str],
) -> dict[str, list[Path]]:
    """Return mapping key source__metric → list of per-country geojson paths."""
    country = path.stem.split("-")[0].upper()
    tol = simplify_tolerance_m(path.stat().st_size)
    layers = [r[0] for r in pyogrio.list_layers(path)]
    produced: dict[str, list[Path]] = {}

    for viz_source in sources:
        wanted = set(SOURCE_LAYERS[viz_source])
        for metric in metrics:
            key = f"{viz_source}__{metric}"
            frames: list[gpd.GeoDataFrame] = []
            for layer in layers:
                parsed = parse_layer(layer)
                if not parsed:
                    continue
                src, met = parsed
                if met != metric or src not in wanted:
                    continue
                print(f"  {country} {layer} (tol={tol:.0f}m)", flush=True)
                try:
                    gdf = load_and_prep_layer(path, layer, country, tol_m=tol)
                except Exception as exc:
                    print(f"    FAIL {exc!r}", flush=True)
                    continue
                if gdf is not None and not gdf.empty:
                    frames.append(gdf)
            if not frames:
                continue
            merged = gpd.GeoDataFrame(pd.concat(frames, ignore_index=True), crs="EPSG:4326")
            # Second dissolve across in-agglomeration + major layers
            rows = []
            for cat, sub in merged.groupby("category", dropna=False):
                geom = unary_union(sub.geometry.values)
                geom = make_valid(geom)
                if geom.is_empty:
                    continue
                rows.append({"category": str(cat), "country": country, "geometry": geom})
            if not rows:
                continue
            final = gpd.GeoDataFrame(rows, crs="EPSG:4326")
            out = workdir / f"{country}_{viz_source}_{metric}.geojson"
            write_geojson(final, out)
            produced.setdefault(key, []).append(out)
            print(f"    → {out.name} ({len(final)} bands)", flush=True)
    return produced


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--contours-dir", type=Path, default=CONT_DIR)
    parser.add_argument("--out-dir", type=Path, default=OUT_DIR)
    parser.add_argument("--public-dir", type=Path, default=PUBLIC_DIR)
    parser.add_argument(
        "--max-mb",
        type=float,
        default=None,
        help="Only process packages at or below this size (MB)",
    )
    parser.add_argument(
        "--include",
        default=None,
        help="Comma-separated country codes, e.g. NL,CH,PT",
    )
    parser.add_argument(
        "--exclude",
        default=None,
        help="Comma-separated country codes to skip",
    )
    parser.add_argument(
        "--sources",
        default="road,rail,aircraft,industry",
    )
    parser.add_argument(
        "--metrics",
        default="Lden,Lnight",
    )
    parser.add_argument(
        "--skip-pmtiles",
        action="store_true",
        help="Only write per-country GeoJSON (no tippecanoe)",
    )
    args = parser.parse_args()

    sources = [s.strip() for s in args.sources.split(",") if s.strip()]
    metrics = [m.strip() for m in args.metrics.split(",") if m.strip()]
    include = (
        {c.strip().upper() for c in args.include.split(",")} if args.include else None
    )
    exclude = (
        {c.strip().upper() for c in args.exclude.split(",")} if args.exclude else set()
    )

    if not shutil.which("tippecanoe") and not args.skip_pmtiles:
        raise SystemExit("tippecanoe not found on PATH")

    args.out_dir.mkdir(parents=True, exist_ok=True)
    args.public_dir.mkdir(parents=True, exist_ok=True)
    geo_root = args.out_dir / "geojson"
    geo_root.mkdir(parents=True, exist_ok=True)

    packages = sorted(args.contours_dir.glob("*.gpkg"), key=lambda p: p.stat().st_size)
    collected: dict[str, list[Path]] = {}
    manifest = {"packages": [], "outputs": {}, "skipped": []}

    for path in packages:
        code = path.stem.split("-")[0].upper()
        if include is not None and code not in include:
            continue
        if code in exclude:
            manifest["skipped"].append({"package": path.name, "reason": "excluded"})
            continue
        if args.max_mb is not None and path.stat().st_size > args.max_mb * 1_000_000:
            manifest["skipped"].append(
                {"package": path.name, "reason": f"over max_mb={args.max_mb}"}
            )
            continue
        if not is_ready(path):
            manifest["skipped"].append({"package": path.name, "reason": "incomplete"})
            continue

        print(f"\n=== {path.name} ===", flush=True)
        country_dir = geo_root / code
        country_dir.mkdir(parents=True, exist_ok=True)
        produced = process_country(path, country_dir, sources, metrics)
        for key, paths in produced.items():
            collected.setdefault(key, []).extend(paths)
        manifest["packages"].append(
            {"package": path.name, "country": code, "bytes": path.stat().st_size}
        )

    if args.skip_pmtiles:
        (args.out_dir / "manifest.json").write_text(json.dumps(manifest, indent=2))
        print("skip-pmtiles: geojson only")
        return 0

    print("\n=== tippecanoe ===", flush=True)
    for key, inputs in sorted(collected.items()):
        viz_source, metric = key.split("__")
        out_name = f"end_{viz_source}_{metric.lower()}.pmtiles"
        out_path = args.out_dir / out_name
        print(f"building {out_name} from {len(inputs)} country files", flush=True)
        build_pmtiles(inputs, out_path, layer_name="contours")
        # Copy slim asset into Vite public
        dest = args.public_dir / out_name
        shutil.copy2(out_path, dest)
        manifest["outputs"][key] = {
            "pmtiles": str(out_path.relative_to(REPO)),
            "public": str(dest.relative_to(REPO)),
            "bytes": out_path.stat().st_size,
            "countries": len(inputs),
        }
        print(f"  → {dest} ({out_path.stat().st_size/1e6:.1f} MB)", flush=True)

    (args.out_dir / "manifest.json").write_text(json.dumps(manifest, indent=2))
    (args.public_dir / "manifest.json").write_text(json.dumps(manifest, indent=2))
    print("\nDone.", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
